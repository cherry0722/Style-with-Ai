"""
Avatar Fabric / Material Mapping Service — V1
=============================================

Purpose:
    Convert wardrobe item visual attributes (category, type, pattern, material,
    fit, colors) into a structured avatar asset-mapping result that can drive
    .glb material slot assignments and asset family selection.

V1 Scope:
    ✓  Top and bottom garments only
    ✓  Rule-based mapping (no ML model required)
    ✓  Produces: avatarAssetFamily, materialPreset, patternPreset,
                 palette (hex), fitPreset, renderHints

Intentionally deferred to later milestones:
    •  Front/back texture projection onto 3D mesh (requires UV unwrap + shader)
    •  Shoes, outerwear, accessory, dress categories
    •  Physics-based cloth simulation
    •  Full 3D cloth reconstruction from photos
    •  Per-garment normal/displacement map baking

.glb pipeline notes:
    The mapping output is designed for a .glb renderer (e.g. react-native-filament
    or three.js) that has:
      – A pre-rigged avatar mesh with named material slots
      – A library of per-family .glb assets (tshirt.glb, hoodie.glb, jeans.glb…)
      – Material presets attached to each asset family
    This service tells the renderer WHICH asset family to load and HOW to tint /
    finish its materials.  Mesh deformation and texture synthesis are out of scope.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Color name → hex lookup table
# Keys are pre-normalized (lowercase, spaces — no hyphens).
# Covers standard fashion color names returned by OpenAI Vision plus the most
# common shade variants a user or curl caller might send.
#
# Rule of thumb for .glb tinting: err on the side of having an entry rather
# than returning null, because a null palette forces the renderer to use a
# default tint that may look wrong on the avatar mesh.
# ---------------------------------------------------------------------------
_COLOR_HEX: Dict[str, str] = {
    # --- Neutrals ---
    "black":        "#1A1A1A",
    "white":        "#F5F5F5",
    "off white":    "#FAF7F2",   # Vision often returns "Off White"
    "cream":        "#FFFDD0",
    "ivory":        "#FFFFF0",
    "snow":         "#FFFAFA",
    "beige":        "#F5F0E8",
    "khaki":        "#C3B091",
    "tan":          "#D2B48C",
    "sand":         "#C2B280",
    # Note: "stone" intentionally omitted — it is a substring of "moonstone",
    # "limestone" etc. and would produce false-positive phrase matches.
    # Vision typically returns "Warm Gray" or "Beige" for stone-toned garments.
    "brown":        "#795548",
    "dark brown":   "#4E342E",
    "light brown":  "#A67B5B",
    "camel":        "#C19A6B",
    # --- Greys ---
    "grey":         "#9E9E9E",   # both spellings indexed
    "gray":         "#9E9E9E",
    "light grey":   "#E0E0E0",
    "light gray":   "#E0E0E0",
    "dark grey":    "#424242",
    "dark gray":    "#424242",
    "charcoal":     "#36454F",
    "heather grey": "#B0B0B0",
    "heather gray": "#B0B0B0",
    "slate":        "#708090",
    "silver":       "#C0C0C0",
    # --- Blues ---
    "navy blue":    "#1B2A4A",
    "navy":         "#1B2A4A",
    "dark blue":    "#1565C0",   # distinct from navy; Vision uses this label
    "deep blue":    "#0D47A1",
    "blue":         "#2196F3",
    "medium blue":  "#5B8CDB",
    "light blue":   "#87CEEB",
    "sky blue":     "#87CEEB",
    "baby blue":    "#89CFF0",
    "royal blue":   "#4169E1",
    "cobalt blue":  "#0047AB",
    "cobalt":       "#0047AB",
    "denim blue":   "#4F6F9F",
    "powder blue":  "#B0E0E6",
    "steel blue":   "#4682B4",
    # --- Greens ---
    "green":        "#4CAF50",
    "dark green":   "#1B5E20",
    "forest green": "#228B22",
    "olive":        "#808000",
    "olive green":  "#808000",
    "army green":   "#4B5320",
    "military green": "#4B5320",
    "sage":         "#9DC183",
    "sage green":   "#9DC183",
    "mint":         "#98FF98",
    "mint green":   "#98FF98",
    "emerald":      "#009B77",
    "emerald green": "#009B77",
    "teal":         "#008080",
    "hunter green": "#355E3B",
    "lime green":   "#32CD32",
    "light green":  "#90EE90",
    # --- Reds ---
    "red":          "#D32F2F",
    "dark red":     "#8B0000",
    "bright red":   "#F44336",
    "light red":    "#EF9A9A",
    "burgundy":     "#800020",
    "maroon":       "#800000",
    "wine":         "#722F37",
    "oxblood":      "#6E1F1F",
    "crimson":      "#DC143C",
    "scarlet":      "#FF2400",
    # --- Pinks ---
    "coral":        "#FF6B6B",
    "pink":         "#F48FB1",
    "light pink":   "#FADADD",
    "hot pink":     "#FF69B4",
    "dusty pink":   "#C4A0A0",
    "dusty rose":   "#C4A0A0",
    "blush":        "#F4C2C2",
    "blush pink":   "#F4C2C2",
    "mauve":        "#C4A0A0",
    "rose":         "#FF007F",
    "rose gold":    "#B76E79",
    "salmon":       "#FA8072",
    "peach":        "#FFCBA4",
    # --- Yellows / Golds / Oranges ---
    "yellow":       "#FFEB3B",
    "light yellow": "#FFF9C4",
    "mustard":      "#FFDB58",
    "mustard yellow": "#FFDB58",
    "gold":         "#FFD700",
    "golden":       "#FFD700",
    "orange":       "#FF9800",
    "burnt orange": "#CC5500",
    "rust":         "#B7410E",
    "terracotta":   "#C87941",
    # --- Purples ---
    "purple":       "#9C27B0",
    "dark purple":  "#6A0572",
    "light purple": "#CE93D8",
    "lavender":     "#E6E6FA",
    "violet":       "#EE82EE",
    "plum":         "#DDA0DD",
    "indigo":       "#3F51B5",
    "lilac":        "#C8A2C8",
    "eggplant":     "#614051",
    # --- Misc ---
    "multicolor":   "#FFFFFF",
    "multi":        "#FFFFFF",
    "tie dye":      "#FFFFFF",
}


# ---------------------------------------------------------------------------
# Top asset family keyword → avatarAssetFamily
# Each entry is a list of substrings checked against the normalized type string.
# Order matters: more specific entries must come before general ones.
# ---------------------------------------------------------------------------
_TOP_FAMILY_RULES: List[tuple[list[str], str]] = [
    # Blazer / sport coat
    (["blazer", "sport coat", "suit jacket"],         "blazer"),
    # Zip-up hoodie (check before generic hoodie)
    (["zip-up hoodie", "zip hoodie"],                 "zip_hoodie"),
    # Hoodie / sweatshirt
    (["hoodie", "sweatshirt"],                        "hoodie"),
    # Sweater / cardigan / knit top
    (["sweater", "cardigan", "pullover", "knitwear"], "sweater"),
    # T-shirt / tee — MUST come before dress_shirt and shirt
    # because "t-shirt" contains "shirt" and would otherwise match
    # the more general rules below.
    (["t-shirt", "tee", "tshirt", "graphic tee",
      "baseball tee", "henley", "polo shirt"],        "tshirt"),
    # Polo (standalone "polo" without "shirt" suffix)
    (["polo"],                                        "polo"),
    # Crop top (before tank so "crop tank" → crop_top)
    (["crop top", "crop"],                            "crop_top"),
    # Tank top
    (["tank", "muscle", "sleeveless"],                "tank"),
    # Dress shirt / button-up (check before generic "shirt")
    (["dress shirt", "button-up", "button down", "oxford shirt",
      "flannel shirt", "linen shirt", "chambray shirt"],   "dress_shirt"),
    # Generic shirt (casual shirt, casual button-up)
    (["shirt"],                                       "shirt"),
]

# Bottom asset family rules
_BOTTOM_FAMILY_RULES: List[tuple[list[str], str]] = [
    # Jeans / denim
    (["jeans", "denim pant", "denim trouser"],        "jeans"),
    # Joggers / track pants / athletic
    (["jogger", "track pant", "athletic pant"],       "joggers"),
    # Sweatpants / sweat pants
    (["sweatpant", "sweat pant"],                     "sweatpants"),
    # Cargo
    (["cargo"],                                       "cargo_pants"),
    # Shorts
    (["shorts", "short"],                             "shorts"),
    # Leggings
    (["legging"],                                     "leggings"),
    # Skirt
    (["skirt"],                                       "skirt"),
    # Chinos / khakis (check before plain trousers)
    (["chino", "khaki"],                              "chinos"),
    # Dress pants / suit pants / trousers
    (["dress pant", "suit pant", "trouser", "slack"], "trousers"),
    # Generic pants fallback
    (["pant"],                                        "trousers"),
]


# ---------------------------------------------------------------------------
# Material / fabric → materialPreset
# ---------------------------------------------------------------------------
_MATERIAL_PRESET_RULES: List[tuple[list[str], str]] = [
    (["denim"],                                               "denim"),
    (["wool", "cashmere", "tweed"],                          "wool"),
    (["fleece", "sherpa", "thermal", "down"],                "fleece"),
    (["knit", "knitwear"],                                    "knit"),
    (["linen", "chambray", "seersucker", "voile", "gauze"],  "linen"),
    (["silk", "satin", "chiffon", "velvet"],                 "formal_fabric"),
    (["leather", "suede", "faux leather"],                    "leather"),
    (["polyester", "nylon", "spandex", "lycra", "elastane",
      "synthetic", "microfiber", "performance"],              "athletic"),
    (["flannel", "corduroy"],                                 "textured_cotton"),
    (["cotton", "jersey", "modal", "rayon", "bamboo",
      "poplin", "twill", "canvas"],                           "cotton"),
]


# ---------------------------------------------------------------------------
# Pattern → patternPreset
# ---------------------------------------------------------------------------
_PATTERN_PRESET_RULES: List[tuple[list[str], str]] = [
    (["striped", "stripes", "stripe"],        "striped"),
    (["plaid", "tartan", "checked", "check"], "plaid"),
    (["floral", "flower"],                    "floral"),
    (["camo", "camouflage"],                  "camo"),
    (["houndstooth"],                         "houndstooth"),
    (["argyle"],                              "argyle"),
    (["paisley"],                             "paisley"),
    (["tie-dye", "tiedye"],                   "tie_dye"),
    (["graphic", "print"],                    "graphic"),
    (["geometric", "abstract"],               "geometric"),
    (["animal print", "leopard", "zebra"],    "animal_print"),
    (["solid", "plain", "clean"],             "solid"),
]


# ---------------------------------------------------------------------------
# Fit → fitPreset
# ---------------------------------------------------------------------------
_FIT_PRESET_RULES: List[tuple[list[str], str]] = [
    (["slim fit", "slim-fit", "slim leg", "skinny"],        "slim"),
    (["regular fit", "regular-fit", "classic fit"],         "regular"),
    (["relaxed fit", "relaxed"],                             "relaxed"),
    (["oversized"],                                          "oversized"),
    (["wide leg", "wide-leg"],                               "wide"),
    (["tapered"],                                            "tapered"),
    (["straight leg", "straight-leg", "straight fit"],      "straight"),
    (["cropped", "crop"],                                    "cropped"),
]


# ---------------------------------------------------------------------------
# surfaceFinish rules: material keyword → finish type
# Default is "matte"; these are checked for overrides.
# ---------------------------------------------------------------------------
_GLOSSY_MATERIALS = {"silk", "satin", "leather", "faux leather", "vinyl", "patent"}
_TEXTURED_MATERIALS = {
    "denim", "corduroy", "tweed", "flannel", "linen", "knit", "knitwear",
    "fleece", "sherpa", "wool", "canvas", "waffle", "textured cotton",
}


# ---------------------------------------------------------------------------
# Shade modifier words that Vision or callers commonly prepend/append to a
# base color name.  These are stripped in the token-fallback pass so that
# e.g. "bright red" resolves to "red" and "pale olive green" to "olive green".
# ---------------------------------------------------------------------------
_SHADE_MODIFIERS: frozenset = frozenset({
    "dark", "light", "bright", "pale", "deep", "dusty", "soft", "warm",
    "cool", "muted", "rich", "vibrant", "bold", "heather", "medium", "mid",
    "pure", "true", "classic", "faded", "washed", "natural", "pastel",
    "neon", "electric", "icy", "frosted", "earthy", "dull", "vivid",
})

# Pre-sort table keys by descending length so the phrase-match pass always
# prefers the most specific entry.  Built once at import time.
_COLOR_KEYS_BY_LENGTH: List[str] = sorted(_COLOR_HEX, key=len, reverse=True)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _norm(s: Optional[str]) -> str:
    """Lowercase + strip + collapse whitespace.  Used for non-color fields."""
    if not s:
        return ""
    return re.sub(r"\s+", " ", s.strip().lower())


def _norm_color(s: str) -> str:
    """
    Normalise a color name for table lookup.

    Extra steps vs _norm:
    • Replace hyphens and underscores with spaces so "off-white" == "off white"
      and "olive_green" == "olive green".
    • Collapse the result to a single-space-separated string.

    This is important for .glb tinting because Vision output and curl payloads
    may use any of these separators for the same logical color name.
    """
    s = s.strip().lower()
    s = s.replace("-", " ").replace("_", " ")
    return re.sub(r"\s+", " ", s).strip()


def _match_rules(
    value: str,
    rules: List[tuple[list[str], str]],
    fallback: str,
) -> str:
    """
    Try each rule in order; return the mapped value for the first rule whose
    keyword list contains a substring match against `value`.
    """
    for keywords, mapped in rules:
        for kw in keywords:
            if kw in value:
                return mapped
    return fallback


def _color_to_hex(color_name: Optional[str]) -> Optional[str]:
    """
    Resolve a fashion color name to a hex string for .glb material tinting.
    Returns None only for truly unrecognisable color names (e.g. 'moonstone haze').

    Resolution passes
    -----------------
    Pass 1 — Exact match after normalization.
              Handles the vast majority of Vision output ('Navy Blue', 'Off-White',
              'Heather Gray').

    Pass 2 — Longest-key phrase match.
              Iterates table keys longest-first so 'olive green' beats 'olive'
              and 'green' when the input is 'dark olive green'.  This catches
              shade-prefixed variants like 'dark navy blue' → navy blue.

    Pass 3 — Shade-modifier stripping + retry.
              Strips adjectives like 'bright', 'pale', 'dusty', 'pure', etc.
              and repeats passes 1 + 2 on the remaining base tokens.
              Handles: 'bright red' → red, 'pure white' → white,
              'dusty olive green' → olive green, 'electric blue' → blue.

    Pass 4 — No match → return None.
              Preserves null behavior for genuinely unknown color descriptors
              so callers can either omit the palette field or forward the raw
              color name as a fallback string to the renderer.
    """
    if not color_name:
        return None

    key = _norm_color(color_name)
    if not key:
        return None

    # Pass 1: exact match
    if key in _COLOR_HEX:
        return _COLOR_HEX[key]

    # Pass 2: longest-key phrase match
    # Longest keys are tried first to prefer specific entries over generic ones
    # (e.g. "navy blue" before "blue" when the input is "dark navy blue").
    for table_key in _COLOR_KEYS_BY_LENGTH:
        if table_key in key:
            return _COLOR_HEX[table_key]

    # Pass 3: strip shade modifiers and retry passes 1 + 2
    tokens = key.split()
    base_tokens = [t for t in tokens if t not in _SHADE_MODIFIERS]
    if base_tokens and base_tokens != tokens:
        base = " ".join(base_tokens)
        if base in _COLOR_HEX:
            return _COLOR_HEX[base]
        for table_key in _COLOR_KEYS_BY_LENGTH:
            if table_key in base:
                return _COLOR_HEX[table_key]

    # Pass 4: unknown color
    return None


def _surface_finish(material: Optional[str]) -> str:
    """
    Derive the surface finish hint from material name.
    glossy  → leather, silk, satin
    textured → denim, knit, corduroy, linen, wool, flannel
    matte   → everything else (cotton, jersey, polyester…)
    """
    m = _norm(material)
    if not m:
        return "matte"
    for gm in _GLOSSY_MATERIALS:
        if gm in m:
            return "glossy"
    for tm in _TEXTURED_MATERIALS:
        if tm in m:
            return "textured"
    return "matte"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def map_item_to_avatar(
    category: Optional[str],
    type_: Optional[str],
    primary_color: Optional[str],
    secondary_color: Optional[str],
    pattern: Optional[str],
    material: Optional[str],
    fit: Optional[str],
    key_details: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Map wardrobe item visual attributes to a structured avatar asset-mapping
    result.

    Parameters (all optional; None is handled gracefully):
        category       – "top" or "bottom" (from ItemProfile.category)
        type_          – item subtype, e.g. "t-shirt", "jeans" (ItemProfile.type)
        primary_color  – e.g. "Navy Blue"   (ItemProfile.primaryColor)
        secondary_color– e.g. "White"        (ItemProfile.secondaryColor)
        pattern        – e.g. "solid", "striped" (ItemProfile.pattern)
        material       – e.g. "cotton", "denim"  (ItemProfile.material)
        fit            – e.g. "slim fit", "regular fit" (ItemProfile.fit)
        key_details    – list of observable details; used to infer asset family
                         and render hints when type is ambiguous.

    Returns:
        Dict matching the AvatarMappingResult schema.
    """
    # --- 1. Normalise all inputs ------------------------------------------------
    cat = _norm(category)
    type_norm = _norm(type_)
    mat_norm = _norm(material)
    pat_norm = _norm(pattern)
    fit_norm = _norm(fit)
    details_norm = " ".join(_norm(d) for d in (key_details or []))
    # Combine type + key_details for richer family lookup
    type_and_details = (type_norm + " " + details_norm).strip()

    # --- 2. avatarCategory -------------------------------------------------------
    # Only "top" and "bottom" are supported in V1.
    # Any other category (shoes, outerwear, dress, accessory) is rejected.
    if cat in ("top", "bottom"):
        avatar_category = cat
    else:
        # Attempt to infer from type keywords when category is missing/unknown
        bottom_keywords = {"pant", "jeans", "trouser", "short", "skirt",
                           "legging", "chino", "cargo", "jogger", "sweatpant"}
        if any(bk in type_and_details for bk in bottom_keywords):
            avatar_category = "bottom"
        else:
            # Default to "top" for ambiguous cases; caller should validate category
            avatar_category = "top"

    # --- 3. avatarAssetFamily ----------------------------------------------------
    # Choose the most specific .glb asset family based on type + key details.
    # The rules are ordered from most-specific to least-specific within each list.
    if avatar_category == "top":
        asset_family = _match_rules(type_and_details, _TOP_FAMILY_RULES, "tshirt")
    else:
        asset_family = _match_rules(type_and_details, _BOTTOM_FAMILY_RULES, "trousers")

    # --- 4. materialPreset -------------------------------------------------------
    # Map fabric/material name to a renderer-friendly preset.
    # "cotton" is the default fallback when material is unknown.
    material_preset = _match_rules(mat_norm, _MATERIAL_PRESET_RULES, "cotton")

    # --- 5. patternPreset --------------------------------------------------------
    # "solid" is the default when pattern is null or not recognised.
    pattern_preset = _match_rules(pat_norm, _PATTERN_PRESET_RULES, "solid")

    # --- 6. palette (primary + secondary hex) ------------------------------------
    primary_hex = _color_to_hex(primary_color)
    secondary_hex = _color_to_hex(secondary_color)

    palette: Dict[str, Optional[str]] = {
        "primary": primary_hex,
        "secondary": secondary_hex,
    }

    # --- 7. fitPreset ------------------------------------------------------------
    fit_preset = _match_rules(fit_norm, _FIT_PRESET_RULES, "regular")

    # --- 8. renderHints ----------------------------------------------------------
    # usePatternTexture: renderer should apply a tiling pattern texture when true
    use_pattern_texture = pattern_preset != "solid"

    # useSecondaryColor: renderer should blend / accent with secondary color slot
    use_secondary_color = secondary_hex is not None

    # surfaceFinish: drives specular/roughness on the material shader
    surface_finish = _surface_finish(material)

    render_hints: Dict[str, Any] = {
        "usePatternTexture": use_pattern_texture,
        "useSecondaryColor": use_secondary_color,
        "surfaceFinish": surface_finish,
        # Reserved for future milestone: front/back texture projection.
        # When Phase 2 adds UV baking these keys will hold R2 texture URLs.
        "frontTextureRef": None,
        "backTextureRef": None,
    }

    # --- 9. Assemble result ------------------------------------------------------
    return {
        "avatarCategory":  avatar_category,
        "avatarAssetFamily": asset_family,
        "materialPreset":  material_preset,
        "patternPreset":   pattern_preset,
        "palette":         palette,
        "fitPreset":       fit_preset,
        "renderHints":     render_hints,
        # Preserve raw input values for debugging / future override logic
        "inputCategory":   category,
        "inputType":       type_,
    }


def map_item_profile_to_avatar(profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convenience wrapper: extract fields from an ItemProfile dict and call
    `map_item_to_avatar`.  Accepts both Vision output dicts (use 'primaryColor')
    and Node wardrobe model dicts (use 'color' / 'color_name').

    Primary color resolution order (first non-None wins):
        primaryColor  — Vision / ItemProfile field name
        color         — Node wardrobe model flat field
        color_name    — Node wardrobe derived field (populated by to_node_profile)
    """
    primary = (
        profile.get("primaryColor")
        or profile.get("color")
        or profile.get("color_name")
    )
    return map_item_to_avatar(
        category=profile.get("category"),
        type_=profile.get("type"),
        primary_color=primary,
        secondary_color=profile.get("secondaryColor"),
        pattern=profile.get("pattern"),
        material=profile.get("material") or profile.get("fabric"),
        fit=profile.get("fit"),
        key_details=profile.get("keyDetails") or [],
    )
