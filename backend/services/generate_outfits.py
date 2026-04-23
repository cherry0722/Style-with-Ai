# services/generate_outfits.py
# Phase 3C+ v2: Text-only outfit generation with scoring, variety ranking, and metadata use.
#
# Pipeline:
#   1. _weather_pre_filter      — remove weather-inappropriate items before LLM
#   2. _call_openai_text        — LLM reasons in slotted schema (top/bottom/footwear/layer)
#                                 with rules for formal, color, pattern, material, and variety;
#                                 maps back to the existing itemIds/why/notes contract
#   3. _deterministic_outfits   — fallback: generates ALL candidate combos, scores each with
#                                 _score_outfit_combo, then selects via _select_diverse_outfits
#                                 for quality + variety across the 3 results

import os
import json
from typing import List, Dict, Any, Optional, Set, Tuple

# ---------------------------------------------------------------------------
# Color-harmony constants
# ---------------------------------------------------------------------------

# Standard neutral tones — pair safely with anything
NEUTRAL_COLORS = {
    "black", "white", "grey", "gray", "navy", "beige", "tan", "cream",
    "off white", "charcoal", "khaki", "ivory", "camel", "stone", "heather grey",
}

# Bold warm hues — two of these together create a visible clash
# Expanded to include pink/magenta/yellow so red+pink and orange+yellow are caught
WARM_COLORS = {
    "red", "orange", "coral", "salmon", "gold", "mustard", "burgundy",
    "pink", "magenta", "fuchsia", "yellow", "bright yellow", "hot pink",
}

# Outerwear type keywords — used for hot-weather pre-filtering
HEAVY_LAYER_KEYWORDS = {"jacket", "coat", "overcoat", "parka", "puffer", "trench"}

# ---------------------------------------------------------------------------
# Formal occasion compatibility constants
# ---------------------------------------------------------------------------

# Item type keywords that score well for formal occasions
FORMAL_TOP_KEYWORDS = {
    "dress shirt", "button-up", "button-down", "oxford shirt", "linen shirt",
    "blouse", "turtleneck", "formal shirt", "chambray shirt",
}
FORMAL_BOTTOM_KEYWORDS = {
    "trousers", "dress pants", "slacks", "suit pants", "pleated pants",
    "dress trousers", "tailored pants",
}
FORMAL_SHOE_KEYWORDS = {
    "loafer", "derby", "oxford", "dress shoe", "heel", "pump",
    "monk strap", "brogue", "chelsea boot",
}
FORMAL_LAYER_KEYWORDS = {
    "blazer", "suit jacket", "sport coat", "sport jacket", "overcoat",
}

# Item type keywords that are penalized for formal occasions
CASUAL_TOP_KEYWORDS = {
    "t-shirt", "tshirt", "tee", "graphic tee", "polo", "hoodie",
    "sweatshirt", "tank top", "crop top", "baseball tee",
}
CASUAL_SHOE_KEYWORDS = {
    "sneaker", "trainer", "running shoe", "canvas shoe", "slip-on",
    "sandal", "flip-flop", "slide",
}
CASUAL_BOTTOM_KEYWORDS = {
    "sweatpants", "jogger", "cargo pants", "athletic shorts",
    "gym shorts", "track pants",
}

# Occasions that trigger formal-compatibility filtering
FORMAL_OCCASIONS = {
    "formal", "gala", "wedding", "black-tie", "business formal",
    "cocktail", "dinner party", "work", "office", "business",
}

# ---------------------------------------------------------------------------
# Pattern compatibility constants (v2)
# ---------------------------------------------------------------------------

# Visually loud / busy patterns — two of these together often clash
LOUD_PATTERNS = {
    "striped", "plaid", "floral", "graphic", "checked", "houndstooth",
    "paisley", "animal print", "camouflage", "camo", "tie-dye", "argyle",
    "abstract", "geometric", "print",
}

# ---------------------------------------------------------------------------
# Material / weather-suitability constants (v2)
# ---------------------------------------------------------------------------

# Lightweight, breathable materials — preferred in hot weather (>= 80 °F)
BREATHABLE_MATERIALS = {
    "cotton", "linen", "chambray", "jersey", "modal", "rayon", "bamboo",
    "seersucker", "voile", "gauze",
}

# Warm, insulating materials — preferred in cold weather (<= 50 °F)
WARM_MATERIALS = {
    "wool", "fleece", "flannel", "knit", "cashmere", "corduroy", "denim",
    "tweed", "sherpa", "thermal", "down",
}

# ---------------------------------------------------------------------------
# Variety-selection tuning (v2)
# ---------------------------------------------------------------------------

# Score deducted per reused core (top/bottom/dress) item when selecting diverse outfits.
# Set high enough to prefer a different top/bottom when alternatives exist,
# but not so high that a forced repeat is deprioritized over a clashing combo.
CORE_VARIETY_PENALTY = 4

# Score deducted per already-selected outfit that shares the same top-type GROUP
# (e.g., a second different tshirt still costs 2 points vs a shirt or hoodie).
# Weaker than CORE_VARIETY_PENALTY to remain a nudge, not a block.
TOP_TYPE_GROUP_PENALTY = 2

# Score deducted per already-selected outfit that shares the same top COLOR BUCKET.
# Prevents "3 outfits, all dark tops" when lighter or accent options exist.
COLOR_BUCKET_PENALTY = 1

# ---------------------------------------------------------------------------
# Near-duplicate detection: type-group + color-bucket lookup tables (v3)
# ---------------------------------------------------------------------------
# These maps are used by _outfit_fingerprint() to compute a "visual signature"
# tuple that groups outfits by look, independent of which exact item is used.
# Two outfits with the same fingerprint are near-duplicates.

# Top-type grouping: group key → frozenset of type substrings that belong to it.
_TOP_TYPE_GROUPS: Dict[str, Set[str]] = {
    "tshirt":  {"t-shirt", "tshirt", "tee", "graphic tee", "baseball tee"},
    "shirt":   {"dress shirt", "button-up", "button-down", "oxford shirt",
                "linen shirt", "oxford", "chambray shirt", "formal shirt"},
    "hoodie":  {"hoodie", "zip hoodie", "zip-up hoodie", "zip-up", "sweatshirt"},
    "polo":    {"polo shirt", "polo"},
    "blazer":  {"blazer", "sport coat", "sport jacket", "suit jacket"},
    "tank":    {"tank top", "tank", "singlet"},
    "sweater": {"sweater", "pullover", "knitwear", "jumper", "cardigan"},
    "crop":    {"crop top", "crop"},
}

# Bottom-type grouping: group key → frozenset of type substrings.
_BOTTOM_TYPE_GROUPS: Dict[str, Set[str]] = {
    "jeans":      {"jeans", "denim"},
    "trousers":   {"trousers", "dress pants", "slacks", "suit pants",
                   "tailored pants", "pleated pants", "dress trousers"},
    "chinos":     {"chinos", "chino"},
    "shorts":     {"shorts"},
    "sweatpants": {"sweatpants", "jogger", "joggers", "track pants"},
    "skirt":      {"skirt"},
    "cargo":      {"cargo pants", "cargo"},
}

# Color bucket grouping: bucket key → set of color substrings.
# Substrings are checked with `in`, so "navy" matches "dark navy", etc.
_COLOR_BUCKETS: Dict[str, Set[str]] = {
    "dark_neutral":  {"black", "charcoal", "dark grey", "dark gray",
                      "midnight", "very dark", "jet"},
    "navy":          {"navy"},
    "light_neutral": {"white", "cream", "off white", "ivory", "beige",
                      "sand", "light grey", "light gray", "heather grey"},
    "warm_accent":   {"red", "orange", "coral", "salmon", "yellow", "mustard",
                      "gold", "burgundy", "wine", "maroon", "rust", "terracotta"},
    "cool_accent":   {"blue", "sky blue", "cobalt", "teal", "green", "sage",
                      "olive", "mint", "purple", "lavender", "violet", "indigo"},
    "pink":          {"pink", "magenta", "fuchsia", "rose"},
    "mid_neutral":   {"grey", "gray", "khaki", "tan", "camel", "stone",
                      "taupe", "brown", "chocolate"},
}


# ---------------------------------------------------------------------------
# Color-harmony helpers
# ---------------------------------------------------------------------------

def _is_neutral(color: Optional[str]) -> bool:
    """Return True if color is a neutral tone that pairs safely with anything."""
    if not color:
        return False
    c = color.lower()
    return any(n in c for n in NEUTRAL_COLORS)


def _colors_clash(color_a: Optional[str], color_b: Optional[str]) -> bool:
    """
    Stronger clash detection: two bold warm hues together (red+orange,
    orange+yellow, red+pink, etc.). Neutrals never clash.
    """
    if not color_a or not color_b:
        return False
    a, b = color_a.lower(), color_b.lower()
    if _is_neutral(a) or _is_neutral(b):
        return False
    a_warm = any(w in a for w in WARM_COLORS)
    b_warm = any(w in b for w in WARM_COLORS)
    return a_warm and b_warm


def _color_pair_score(color_top: Optional[str], color_bottom: Optional[str]) -> int:
    """
    Score a top+bottom color pairing.
      +2  → neutral base (safe pairing)
       0  → no clash but no neutral either (acceptable)
      -2  → strong clash (penalize heavily so it sinks to the bottom of the sort)
    """
    if _colors_clash(color_top, color_bottom):
        return -2
    if _is_neutral(color_top) or _is_neutral(color_bottom):
        return 2
    return 0


# ---------------------------------------------------------------------------
# Formal occasion compatibility scoring
# ---------------------------------------------------------------------------

def _is_formal_occasion(occasion: Optional[str]) -> bool:
    """Return True when the occasion requires formal-compatible clothing."""
    if not occasion:
        return False
    occ = occasion.lower().strip()
    return any(f in occ for f in FORMAL_OCCASIONS)


def _formal_compatibility_score(item: Dict[str, Any]) -> int:
    """
    Score an item's compatibility with a formal occasion.
      +2  → clearly formal (dress shirt, trousers, loafers, blazer)
       0  → neutral / unknown
      -2  → clearly casual (t-shirt, sneakers, sweatpants)
    Plus ±1 tiebreaker from Vision formality field (>= 7 / <= 3).
    """
    profile = item.get("profile") or {}
    item_type = (profile.get("type") or "").lower()
    formality_val = profile.get("formality")

    score = 0
    if any(kw in item_type for kw in FORMAL_TOP_KEYWORDS):
        score += 2
    elif any(kw in item_type for kw in CASUAL_TOP_KEYWORDS):
        score -= 2
    if any(kw in item_type for kw in FORMAL_BOTTOM_KEYWORDS):
        score += 2
    elif any(kw in item_type for kw in CASUAL_BOTTOM_KEYWORDS):
        score -= 2
    if any(kw in item_type for kw in FORMAL_SHOE_KEYWORDS):
        score += 2
    elif any(kw in item_type for kw in CASUAL_SHOE_KEYWORDS):
        score -= 2
    if any(kw in item_type for kw in FORMAL_LAYER_KEYWORDS):
        score += 2
    if formality_val is not None:
        try:
            f = int(formality_val)
            if f >= 7:
                score += 1
            elif f <= 3:
                score -= 1
        except (ValueError, TypeError):
            pass
    return score


# ---------------------------------------------------------------------------
# Pattern helpers (v2)
# ---------------------------------------------------------------------------

def _is_loud_pattern(pattern: Optional[str]) -> bool:
    """Return True if the pattern is visually loud (non-solid/non-minimal)."""
    if not pattern:
        return False
    p = pattern.lower()
    return any(loud in p for loud in LOUD_PATTERNS)


# ---------------------------------------------------------------------------
# Material / weather suitability helpers (v2)
# ---------------------------------------------------------------------------

def _material_weather_score(material: Optional[str], temp_f: Optional[float]) -> int:
    """
    +1 if the material suits the current temperature.
    -1 if it is inappropriate (e.g., heavy wool in 90 °F heat).
     0 if temperature is unknown or the material is weather-neutral.

    Used to surface seasonally appropriate items — linen rises in summer,
    fleece/wool rise in winter.
    """
    if not material or temp_f is None:
        return 0
    m = material.lower()
    is_breathable = any(bm in m for bm in BREATHABLE_MATERIALS)
    is_warm = any(wm in m for wm in WARM_MATERIALS)
    if temp_f >= 80:
        if is_breathable:
            return 1
        if is_warm:
            return -1
    elif temp_f <= 50:
        if is_warm:
            return 1
        if is_breathable and not is_warm:
            return -1
    return 0


# ---------------------------------------------------------------------------
# Category normalization
# ---------------------------------------------------------------------------

def _normalize_category(profile: Optional[Dict[str, Any]]) -> str:
    """Map item profile to: top, bottom, shoes, dress, outerwear, or other."""
    if not profile:
        return "other"
    c = (profile.get("category") or "").lower()
    t = (profile.get("type") or "").lower()
    if c in ("top", "tops") or any(x in t for x in ("shirt", "tee", "blouse", "sweater", "polo")):
        return "top"
    if c in ("bottom", "bottoms") or any(x in t for x in ("pants", "jeans", "chinos", "shorts", "skirt", "trouser")):
        return "bottom"
    if c in ("shoes", "shoe") or any(x in t for x in ("sneaker", "boot", "loafer", "heel", "sandal", "trainer")):
        return "shoes"
    if c == "dress" or "dress" in t:
        return "dress"
    if c == "outerwear" or any(x in t for x in ("jacket", "coat", "blazer", "cardigan", "overcoat", "hoodie")):
        return "outerwear"
    return "other"


# ---------------------------------------------------------------------------
# Near-duplicate fingerprint helpers (v3)
# ---------------------------------------------------------------------------

def _top_type_group(item: Dict[str, Any]) -> str:
    """Return the canonical top-type group key for this item, or 'other_top'."""
    item_type = ((item.get("profile") or {}).get("type") or "").lower().strip()
    for group, keywords in _TOP_TYPE_GROUPS.items():
        if any(kw in item_type for kw in keywords):
            return group
    return "other_top"


def _bottom_type_group(item: Dict[str, Any]) -> str:
    """Return the canonical bottom-type group key, or 'other_bottom'."""
    item_type = ((item.get("profile") or {}).get("type") or "").lower().strip()
    for group, keywords in _BOTTOM_TYPE_GROUPS.items():
        if any(kw in item_type for kw in keywords):
            return group
    return "other_bottom"


def _color_bucket(color: Optional[str]) -> str:
    """Map a color string to a broad bucket key, or 'other'."""
    if not color:
        return "unknown"
    c = color.lower().strip()
    for bucket, keywords in _COLOR_BUCKETS.items():
        if any(kw in c for kw in keywords):
            return bucket
    return "other"


def _outfit_fingerprint(combo_items: List[Dict[str, Any]]) -> Tuple[str, str, str, str]:
    """
    Compute a 4-tuple visual-similarity fingerprint:
        (top_type_group, bottom_type_group, top_color_bucket, formality_tier)

    Two outfits sharing all four dimensions are near-duplicates — they look
    effectively the same regardless of which exact items were selected.
    Used in _select_diverse_outfits and _near_duplicate_check.
    """
    top_item = next(
        (it for it in combo_items if _normalize_category(it.get("profile")) == "top"),
        None,
    )
    bot_item = next(
        (it for it in combo_items
         if _normalize_category(it.get("profile")) in ("bottom", "dress")),
        None,
    )
    top_grp   = _top_type_group(top_item)    if top_item else "none"
    bot_grp   = _bottom_type_group(bot_item) if bot_item else "none"
    top_color = _color_bucket(
        (top_item.get("profile") or {}).get("primaryColor")
    ) if top_item else "unknown"
    formality = (top_item.get("profile") or {}).get("formality", 5) if top_item else 5
    tier = "casual" if formality <= 4 else ("formal" if formality >= 8 else "smart_casual")
    return (top_grp, bot_grp, top_color, tier)


# ---------------------------------------------------------------------------
# PairingHints cross-reference bonus (v2)
# ---------------------------------------------------------------------------

def _pairing_hints_bonus(combo_items: List[Dict[str, Any]]) -> int:
    """
    Reward outfits where items explicitly suggest each other via pairingHints.

    If item A's pairingHints mentions the type of item B in the same combo
    (e.g., 'pairs well with chinos' and B is chinos), add +1. This turns
    pairingHints from passive display text into an active ranking signal.
    Capped at +3 to prevent dominating the total score.
    """
    type_words: Set[str] = set()
    for it in combo_items:
        profile = it.get("profile") or {}
        for word in (profile.get("type") or "").lower().split():
            if len(word) > 3:
                type_words.add(word)

    bonus = 0
    for it in combo_items:
        profile = it.get("profile") or {}
        for hint in (profile.get("pairingHints") or []):
            hint_lower = hint.lower()
            for word in type_words:
                if word in hint_lower:
                    bonus += 1
                    break  # max 1 bonus per hint
    return min(bonus, 3)


# ---------------------------------------------------------------------------
# Outfit completeness scoring (v2)
# ---------------------------------------------------------------------------

def _completeness_score(
    cat_counts: Dict[str, int],
    temp_f: Optional[float],
    has_outerwear: bool,
) -> int:
    """
    Score how structurally complete the outfit is.
      +2  has top + bottom (or dress) — core requirement
      +1  has shoes
      -1  missing shoes on an otherwise complete outfit
      +1  has outerwear/layer when cold (temp_f <= 54)
    """
    has_top_bottom = (cat_counts.get("top", 0) > 0 and cat_counts.get("bottom", 0) > 0)
    has_dress = cat_counts.get("dress", 0) > 0
    has_shoes = cat_counts.get("shoes", 0) > 0

    score = 0
    if has_top_bottom or has_dress:
        score += 2
    if has_shoes:
        score += 1
    elif has_top_bottom or has_dress:
        score -= 1  # mild penalty for missing shoes on an otherwise complete outfit
    if temp_f is not None and temp_f <= 54 and has_outerwear:
        score += 1  # layered for cold = better
    return score


# ---------------------------------------------------------------------------
# Master outfit combo scorer (v2)
# ---------------------------------------------------------------------------

def _score_outfit_combo(
    combo_items: List[Dict[str, Any]],
    occasion: Optional[str],
    temp_f: Optional[float],
) -> int:
    """
    Score a candidate outfit combination. Higher score = better outfit.

    Scoring factors (each contributes independently):
    1. Completeness        — top+bottom core, shoes, cold-weather layer
    2. Color harmony       — neutral base reward, bold-warm-clash penalty
    3. Pattern clash       — -2 for two loud patterns in the same outfit
    4. Material/weather    — +1/-1 per item for seasonal appropriateness
    5. Formal compatibility— +1/-1 per item when occasion is formal
    6. PairingHints cross  — +1 per hint match (capped at +3)
    """
    if not combo_items:
        return -99

    profiles = [it.get("profile") or {} for it in combo_items]

    # Category counts for completeness and color scoring
    cats: Dict[str, int] = {}
    for it in combo_items:
        cat = _normalize_category(it.get("profile"))
        cats[cat] = cats.get(cat, 0) + 1
    has_outerwear = cats.get("outerwear", 0) > 0

    score = 0

    # 1. Completeness — rewards full, wearable outfits
    score += _completeness_score(cats, temp_f, has_outerwear)

    # 2. Color harmony — top vs bottom primary colors
    top_color: Optional[str] = None
    bottom_color: Optional[str] = None
    for it in combo_items:
        cat = _normalize_category(it.get("profile"))
        c = (it.get("profile") or {}).get("primaryColor")
        if cat == "top" and top_color is None:
            top_color = c
        elif cat in ("bottom", "dress") and bottom_color is None:
            bottom_color = c
    score += _color_pair_score(top_color, bottom_color)

    # 3. Pattern clash — penalize two loud patterns in the same outfit
    loud_count = sum(1 for p in profiles if _is_loud_pattern(p.get("pattern")))
    if loud_count >= 2:
        score -= 2  # two loud patterns rarely work together

    # 4. Material / weather suitability — summed across all items
    for p in profiles:
        score += _material_weather_score(p.get("material"), temp_f)

    # 5. Formal compatibility — when occasion is formal, reward formal items
    if _is_formal_occasion(occasion):
        for it in combo_items:
            fc = _formal_compatibility_score(it)
            score += max(-1, min(1, fc // 2))  # clamp contribution to ±1 per item

    # 6. PairingHints cross-reference — reward items that suggest each other
    score += _pairing_hints_bonus(combo_items)

    return score


# ---------------------------------------------------------------------------
# Diversity-aware outfit selector (v2)
# ---------------------------------------------------------------------------

def _select_diverse_outfits(
    scored_combos: List[Tuple[int, List[Dict[str, Any]], List[str], Dict[str, Any]]],
    target: int = 3,
) -> List[Dict[str, Any]]:
    """
    Greedy diversity-aware selection from scored outfit candidates (v3).

    Penalty layers (cumulative, applied per candidate):
      1. CORE_VARIETY_PENALTY   — per reused top/bottom/dress item ID.
         Discourages the exact same item appearing in multiple outfits.
      2. TOP_TYPE_GROUP_PENALTY — per already-selected outfit that shares the
         same top TYPE GROUP (e.g., a second tshirt costs 2 pts vs a shirt).
         Nudges selection toward categorical variety (tshirt → shirt → hoodie).
      3. COLOR_BUCKET_PENALTY   — per already-selected outfit that shares the
         same top COLOR BUCKET. Prevents "all 3 outfits have dark tops".

    Shoes and outerwear are NOT penalized for overlap — varying only shoes
    while keeping the same core is still acceptable variety.
    When all candidates share the same group/color (small wardrobe), the
    penalties still select the best available option without blocking.
    """
    selected: List[Dict[str, Any]] = []
    used_core_ids: Set[str] = set()
    used_id_sets: Set[frozenset] = set()
    used_top_groups: List[str] = []   # ordered list, count() gives overlap
    used_top_colors: List[str] = []   # ordered list, count() gives overlap

    remaining = list(scored_combos)

    while len(selected) < target and remaining:
        best_idx = -1
        best_eff_score = float("-inf")

        for idx, (raw_score, combo_items, item_ids, _) in enumerate(remaining):
            id_set = frozenset(item_ids)
            if id_set in used_id_sets:
                continue  # exact duplicate — skip entirely

            # Layer 1: existing core-item penalty
            core_overlap = sum(
                1
                for it, iid in zip(combo_items, item_ids)
                if _normalize_category(it.get("profile")) in ("top", "bottom", "dress")
                and iid in used_core_ids
            )
            eff_score = raw_score - core_overlap * CORE_VARIETY_PENALTY

            # Layer 2: top-type group penalty (same style category)
            fp = _outfit_fingerprint(combo_items)
            eff_score -= used_top_groups.count(fp[0]) * TOP_TYPE_GROUP_PENALTY

            # Layer 3: top-color bucket penalty (same dominant color tone)
            eff_score -= used_top_colors.count(fp[2]) * COLOR_BUCKET_PENALTY

            if eff_score > best_eff_score:
                best_eff_score = eff_score
                best_idx = idx

        if best_idx == -1:
            break

        raw_score, combo_items, item_ids, outfit_dict = remaining.pop(best_idx)
        selected.append(outfit_dict)
        used_id_sets.add(frozenset(item_ids))

        # Register core items and fingerprint dimensions as used
        for it, iid in zip(combo_items, item_ids):
            if _normalize_category(it.get("profile")) in ("top", "bottom", "dress"):
                used_core_ids.add(iid)
        fp = _outfit_fingerprint(combo_items)
        used_top_groups.append(fp[0])
        used_top_colors.append(fp[2])

    return selected


# ---------------------------------------------------------------------------
# Weather pre-filter
# ---------------------------------------------------------------------------

def _weather_pre_filter(
    items: List[Dict[str, Any]],
    temp_f: Optional[float],
) -> List[Dict[str, Any]]:
    """
    Remove weather-inappropriate items BEFORE the LLM call.
    - Hot (>= 80 °F): exclude heavy outerwear (jackets, coats, hoodies, cardigans).
    - Cold (<= 45 °F): keep everything; LLM/fallback adds layers naturally.
    - No temperature: no filtering.
    Never returns an empty list — falls back to unfiltered if all items are removed.
    """
    if temp_f is None:
        return items

    filtered = []
    for it in items:
        profile = it.get("profile") or {}
        item_type = (profile.get("type") or "").lower()
        category = _normalize_category(profile)

        if temp_f >= 80 and category == "outerwear":
            if any(kw in item_type for kw in HEAVY_LAYER_KEYWORDS | {"hoodie", "cardigan"}):
                continue

        filtered.append(it)

    return filtered if filtered else items


# ---------------------------------------------------------------------------
# Internal LLM schema
# ---------------------------------------------------------------------------
# The LLM reasons in SLOTS (top/bottom/footwear/layer) to force thinking about
# outfit completeness and compatibility; results map back to itemIds/why/notes.

_LLM_INTERNAL_SCHEMA = """{
  "outfits": [
    {
      "name": "short outfit name, e.g. 'Relaxed Weekend', 'Smart Casual Evening'",
      "occasion": "occasion this works for, e.g. 'casual', 'office', 'formal', 'date-night'",
      "slot_assignments": {
        "top":      "<id of the top/shirt item, or null>",
        "bottom":   "<id of the pants/skirt/dress item, or null>",
        "footwear": "<id of the shoes item, or null>",
        "layer":    "<id of a jacket/blazer/outerwear item, or null if not needed>"
      },
      "reasoning": "1-2 sentences: why this outfit works — color harmony, occasion fit, weather/material, pattern notes."
    }
  ]
}"""


# ---------------------------------------------------------------------------
# LLM item summary builder
# ---------------------------------------------------------------------------

def _build_item_summary(it: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build a rich item summary for the LLM prompt including all profile fields
    relevant to outfit reasoning: pattern, material, fit, pairingHints, etc.
    """
    profile = it.get("profile") or {}
    return {
        "id": it.get("id") or "",
        "category": profile.get("category"),
        "type": profile.get("type"),
        "primaryColor": profile.get("primaryColor"),
        "secondaryColor": profile.get("secondaryColor"),
        "pattern": profile.get("pattern"),
        "material": profile.get("material"),
        "fit": profile.get("fit"),
        "formality": profile.get("formality"),  # 0–10 from Vision
        "season": profile.get("season"),
        "styleTags": profile.get("styleTags") or [],
        "keyDetails": (profile.get("keyDetails") or [])[:3],
        "pairingHints": (profile.get("pairingHints") or [])[:3],
    }


# ---------------------------------------------------------------------------
# OpenAI TEXT call (structured reasoning)
# ---------------------------------------------------------------------------

def _build_system_prompt(occasion: Optional[str]) -> str:
    """
    Build the LLM system prompt with full quality rules.
    v2 adds: pattern clash rule, material/weather rule, pairingHints guidance,
    and a stronger variety rule requiring different tops/bottoms across outfits.
    """
    formal = _is_formal_occasion(occasion)

    base = (
        "You are a professional fashion stylist AI. "
        "Generate realistic, wearable, stylish outfits using ONLY the provided wardrobe items. "
        "Do NOT invent items or use IDs not in the list.\n\n"
        "Quality rules:\n"
        "1. OCCASION — match formality level to occasion. "
        "Casual = formality 0–5. Office/work = 6+. Date night = 7+. Formal/gala/wedding = 8+. Gym = athletic.\n"
        "2. WEATHER & MATERIALS — if tempF >= 80 °F, never assign a heavy jacket/coat/hoodie to the layer slot. "
        "If tempF <= 50 °F, strongly prefer adding an outerwear layer when available. "
        "In hot weather prefer breathable materials (cotton, linen, chambray, jersey). "
        "In cold weather prefer warm materials (wool, fleece, flannel, knit, cashmere).\n"
        "3. COLOR HARMONY — prefer a neutral base (black, white, navy, grey, beige, charcoal) "
        "paired with at most one accent color. "
        "NEVER pair two bold warm colors together (e.g., red + orange, orange + yellow, red + pink). "
        "Use pairingHints from item profiles — if item A says 'pairs well with chinos' "
        "and chinos are available, prioritize that pairing.\n"
        "4. PATTERN RULE — avoid pairing two visually loud patterns in the same outfit "
        "(e.g., striped shirt + plaid pants, floral top + graphic tee). "
        "One loud pattern + one solid is always acceptable. "
        "Two solids together is always safe.\n"
        "5. COMPLETENESS — a minimum viable outfit needs top + bottom OR a dress. "
        "Footwear improves any look. A layer slot is optional.\n"
        "6. VARIETY (CRITICAL) — the 3 outfits MUST be meaningfully distinct:\n"
        "   a. TOP ITEM: use a different top item in each outfit when multiple are available.\n"
        "   b. BOTTOM ITEM: use a different bottom item in each outfit when multiple are available.\n"
        "   c. COLOR STORY: vary the dominant color tone across outfits. Avoid returning 3 outfits "
        "where all tops share the same color group (e.g., all dark/navy, all white, all neutral). "
        "If one outfit uses a dark top, at least one other should try a lighter or accented top "
        "when such items exist.\n"
        "   d. VIBE/CATEGORY: vary the top category across outfits when possible "
        "(e.g., not 3 different tshirts — try tshirt + button-up + hoodie if available). "
        "Aim for at least one casual and one elevated/smart option when the wardrobe allows.\n"
        "   e. NEVER return 3 outfits that resolve to the same itemIds set.\n"
        "   f. If the wardrobe forces any repeat (item, color, or category), acknowledge this "
        "explicitly in the reasoning field.\n"
    )

    formal_rule = ""
    if formal:
        formal_rule = (
            "7. FORMAL OCCASIONS (CRITICAL) — The requested occasion is formal. "
            "You MUST follow these rules strictly:\n"
            "   a. Top slot: use dress shirts, button-up shirts, Oxford shirts, blouses, or turtlenecks. "
            "NEVER use t-shirts, hoodies, graphic tees, or polo shirts if a formal top is available.\n"
            "   b. Bottom slot: use trousers, dress pants, slacks, or tailored pants. "
            "NEVER use casual jeans, sweatpants, or shorts if formal bottoms are available.\n"
            "   c. Footwear slot: use loafers, derbies, Oxford shoes, heels, monk straps, or Chelsea boots. "
            "NEVER use sneakers, trainers, or canvas shoes if formal footwear is available.\n"
            "   d. Layer slot (if used): use a blazer, suit jacket, or sport coat — not a hoodie.\n"
            "   e. If only casual items exist, use the least-casual option and note the limitation.\n"
        )

    footer = (
        "\nOutput STRICT JSON only. No markdown, no code fences, no text outside JSON.\n"
        "Schema:\n" + _LLM_INTERNAL_SCHEMA.strip() + "\n\n"
        "Slot rules:\n"
        "- Set a slot to null if no suitable item exists for it.\n"
        "- Use only the exact id strings from the provided item list.\n"
        "- Return exactly 3 outfits when enough distinct combinations exist."
    )

    return base + formal_rule + footer


def _call_openai_text(
    items: List[Dict[str, Any]],
    occasion: Optional[str],
    location: Optional[Dict[str, Any]],
    weather: Optional[Dict[str, Any]],
) -> Optional[List[Dict[str, Any]]]:
    """
    Call OpenAI with structured fashion-reasoning prompt.

    Flow:
    1. Build rich item summaries (pattern, material, fit, pairingHints, etc.).
    2. Slot-based schema prompt forces reasoning about completeness, formality,
       color, patterns, materials, pairingHints, and variety.
    3. Validate all slot assignments reference real item IDs.
    4. Map structured response → existing API contract:
         slot ids → itemIds, reasoning → why, name + occasion → notes.

    Returns list of outfit dicts or None on any failure.
    """
    try:
        from openai import OpenAI
    except ImportError:
        return None

    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        return None

    item_summaries = [_build_item_summary(it) for it in items]
    context = {
        "occasion": occasion or "casual",
        "location": location,
        "weather": weather,
    }

    system = _build_system_prompt(occasion)
    user = (
        f"Context: {json.dumps(context)}\n\n"
        f"Wardrobe items: {json.dumps(item_summaries)}\n\n"
        'Generate 3 outfits. Return JSON with key "outfits" (array of 3 outfit objects).'
    )

    try:
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=1000,
            response_format={"type": "json_object"},
            timeout=20.0,
        )
        raw = (resp.choices[0].message.content or "").strip()
        if not raw:
            return None

        data = json.loads(raw)
        outfits_raw = data.get("outfits")
        if not isinstance(outfits_raw, list):
            return None

        valid_ids = {str(it.get("id")) for it in items}
        result = []

        for o in outfits_raw[:3]:
            if not isinstance(o, dict):
                continue

            # Map slot_assignments → itemIds (ordered: top, bottom, footwear, layer)
            slots = o.get("slot_assignments") or {}
            item_ids: List[str] = []
            for slot_key in ("top", "bottom", "footwear", "layer"):
                val = slots.get(slot_key)
                if val and str(val) in valid_ids:
                    item_ids.append(str(val))

            # Accept legacy flat itemIds format as fallback
            if not item_ids:
                legacy = o.get("itemIds") or []
                item_ids = [str(i) for i in legacy if str(i) in valid_ids]

            if not item_ids:
                continue

            reasoning = (o.get("reasoning") or "").strip() or "Outfit combination."
            notes: List[str] = []
            name = (o.get("name") or "").strip()
            occ = (o.get("occasion") or "").strip()
            if name:
                notes.append(name)
            if occ:
                notes.append(f"Occasion: {occ}")

            result.append({"itemIds": item_ids, "why": reasoning, "notes": notes})

        return result if result else None

    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(f"[generate_outfits] OpenAI JSON error: {e}")
        return None
    except Exception as e:
        print(f"[generate_outfits] OpenAI call failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Deterministic fallback (v2: full scoring + diversity selection)
# ---------------------------------------------------------------------------

def _deterministic_outfits(
    items: List[Dict[str, Any]],
    occasion: Optional[str],
    weather: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Fallback outfit builder when OpenAI is unavailable.

    v2 improvements over v1:
    - Generates ALL valid candidate combos (top+bottom+shoes+optional layer).
    - Scores each with _score_outfit_combo (color, pattern, material, formality,
      completeness, pairingHints) rather than just color-sorting the first 4×4 pairs.
    - Selects final 3 using _select_diverse_outfits, which penalizes repeated
      tops/bottoms so different silhouettes rise to the top.
    - Previously took the first 3 non-duplicate hits; now picks the best 3 by quality
      while maximizing variety across the results.
    """
    by_cat: Dict[str, List[Dict[str, Any]]] = {
        "top": [], "bottom": [], "shoes": [], "dress": [], "outerwear": [], "other": [],
    }
    for it in items:
        cat = _normalize_category(it.get("profile"))
        by_cat.setdefault(cat, []).append(it)

    tops = by_cat["top"]
    bottoms = by_cat["bottom"]
    shoes = by_cat["shoes"]
    dresses = by_cat["dress"]
    outerwear = by_cat["outerwear"]

    occasion_str = (occasion or "casual").lower()
    is_formal = _is_formal_occasion(occasion)

    temp_f: Optional[float] = None
    if weather and isinstance(weather.get("tempF"), (int, float)):
        temp_f = float(weather["tempF"])

    # Hot weather: drop outerwear entirely (mirrors LLM rule 2)
    if temp_f is not None and temp_f >= 80:
        outerwear = []

    # Weather note for why text
    if temp_f is None:
        weather_note = ""
    elif temp_f < 50:
        weather_note = "Layered for cool weather."
    elif temp_f < 75:
        weather_note = "Good for mild temperatures."
    else:
        weather_note = "Light and breathable for warm weather."

    # Formal sorting: dress shirts / trousers / loafers float to top of each list
    if is_formal:
        tops = sorted(tops, key=lambda x: -_formal_compatibility_score(x))
        bottoms = sorted(bottoms, key=lambda x: -_formal_compatibility_score(x))
        shoes = sorted(shoes, key=lambda x: -_formal_compatibility_score(x))
        outerwear = sorted(outerwear, key=lambda x: -_formal_compatibility_score(x))

    # Add a layer to every combo when cold and outerwear is available
    layer = outerwear[0] if (temp_f is not None and temp_f <= 54 and outerwear) else None

    # Shoe options: use up to 3 shoes; if none available, use [None] (no-shoe combo)
    shoe_slots: List[Optional[Dict[str, Any]]] = shoes[:3] if shoes else [None]

    # --- Generate all candidate combos ---
    # Tuple layout: (score, combo_items, item_ids, outfit_dict)
    all_candidates: List[Tuple[int, List[Dict], List[str], Dict]] = []

    def _build_outfit_dict(combo_items: List[Dict]) -> Dict:
        """Build the outfit response dict (itemIds, why, notes) for a combo."""
        ids = [it["id"] for it in combo_items]
        top_item = next(
            (it for it in combo_items if _normalize_category(it.get("profile")) == "top"), None
        )
        bot_item = next(
            (it for it in combo_items
             if _normalize_category(it.get("profile")) in ("bottom", "dress")), None
        )
        tc = (top_item.get("profile") or {}).get("primaryColor", "") if top_item else ""
        bc = (bot_item.get("profile") or {}).get("primaryColor", "") if bot_item else ""
        color_note = f"{tc} top with {bc} bottom. " if tc and bc else ""
        layer_note = (
            " Layered for warmth."
            if layer and any(it["id"] == layer["id"] for it in combo_items)
            else ""
        )
        why = (
            f"{color_note}{'Formal' if is_formal else 'Complete'} outfit "
            f"for {occasion_str}. {weather_note}{layer_note}"
        ).strip()
        notes = ["Formal combination." if is_formal else "Color-matched combination."]
        return {"itemIds": ids, "why": why, "notes": notes}

    def _add_combo(combo_items: List[Dict]) -> None:
        """Score and register a candidate combo."""
        score = _score_outfit_combo(combo_items, occasion, temp_f)
        ids = [it["id"] for it in combo_items]
        outfit_dict = _build_outfit_dict(combo_items)
        all_candidates.append((score, combo_items, ids, outfit_dict))

    # Top + bottom combos (up to 5×5 pairs × shoe_slots × optional layer)
    for t in tops[:5]:
        for b in bottoms[:5]:
            for s in shoe_slots:
                combo: List[Dict] = [t, b]
                if s is not None:
                    combo.append(s)
                if layer is not None:
                    combo.append(layer)
                _add_combo(combo)

    # Dress combos
    for d in dresses[:3]:
        for s in shoe_slots:
            combo = [d]
            if s is not None:
                combo.append(s)
            if layer is not None:
                combo.append(layer)
            _add_combo(combo)

    # Sort all candidates by score descending, then select for variety
    all_candidates.sort(key=lambda x: -x[0])
    outfits = _select_diverse_outfits(all_candidates, target=3)

    # Single-item fallback: if no top+bottom or dress combos were available
    if not outfits:
        used_single: Set[str] = set()
        for it in items:
            if len(outfits) >= 3:
                break
            pid = it.get("id")
            if not pid or pid in used_single:
                continue
            used_single.add(pid)
            profile = it.get("profile") or {}
            color = (profile.get("primaryColor") or "neutral").strip()
            why = f"Single item for {occasion_str}. {color} tone. {weather_note}".strip()
            outfits.append({
                "itemIds": [pid],
                "why": why,
                "notes": ["Add more pieces to complete the look."],
            })

    # Duplicate padding: honestly acknowledge limited wardrobe rather than
    # silently repeating or fabricating variety.
    if outfits and len(outfits) < 3:
        base = outfits[0]
        while len(outfits) < 3:
            outfits.append({
                "itemIds": base["itemIds"],
                "why": base["why"],
                "notes": ["Limited wardrobe — fewer unique combinations available."],
            })

    return outfits[:3]


# ---------------------------------------------------------------------------
# Near-duplicate post-processor (v3) — fires after LLM, before _mark_duplicates
# ---------------------------------------------------------------------------

def _near_duplicate_check(
    outfits: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
    occasion: Optional[str],
    weather_dict: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Detect and resolve near-duplicate outfits returned by the LLM.

    Two outfits are "near-duplicates" when they share the same
    (top_type_group, top_color_bucket) visual key — meaning they look
    effectively identical at a glance regardless of exact items used
    (e.g., "white tshirt + black jeans" vs "white tshirt + dark jeans").

    Strategy:
      1. Walk through LLM outfits in order; compute fingerprint for each.
      2. If an outfit's visual key matches an already-confirmed outfit,
         it is a near-duplicate.
      3. Run _deterministic_outfits() to obtain an alternative candidate
         pool, then substitute the near-duplicate with the best candidate
         whose visual key is new.
      4. If no suitable substitute exists (tiny wardrobe), keep the outfit
         unchanged but append a note so the user sees honest messaging.

    This function is intentionally NOT called on the deterministic path —
    _select_diverse_outfits already enforces fingerprint diversity there.
    """
    if len(outfits) <= 1:
        return outfits

    id_to_item: Dict[str, Dict[str, Any]] = {
        str(it.get("id")): it for it in items
    }

    def _combo_for(outfit: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            id_to_item[iid]
            for iid in (outfit.get("itemIds") or [])
            if iid in id_to_item
        ]

    # First pass: identify near-duplicate indices
    confirmed_vis_keys: List[Tuple[str, str]] = []
    dup_indices: List[int] = []
    result: List[Dict[str, Any]] = [dict(o) for o in outfits]

    for i, outfit in enumerate(result):
        fp = _outfit_fingerprint(_combo_for(outfit))
        vis_key = (fp[0], fp[2])  # (top_type_group, top_color_bucket)
        if vis_key in confirmed_vis_keys:
            dup_indices.append(i)
        else:
            confirmed_vis_keys.append(vis_key)

    if not dup_indices:
        return result  # nothing to fix

    # Build deterministic alternatives as substitute candidates
    det_outfits = _deterministic_outfits(items, occasion, weather_dict)

    confirmed_id_sets: Set[frozenset] = {
        frozenset(result[i].get("itemIds") or [])
        for i in range(len(result))
        if i not in dup_indices
    }

    for dup_idx in dup_indices:
        replaced = False
        for candidate in det_outfits:
            cand_ids = frozenset(candidate.get("itemIds") or [])
            if cand_ids in confirmed_id_sets:
                continue
            cand_fp  = _outfit_fingerprint(_combo_for(candidate))
            cand_vis = (cand_fp[0], cand_fp[2])
            if cand_vis not in confirmed_vis_keys:
                result[dup_idx] = dict(candidate)
                confirmed_id_sets.add(cand_ids)
                confirmed_vis_keys.append(cand_vis)
                replaced = True
                break

        if not replaced:
            # No visually distinct substitute available — annotate honestly
            notes = list(result[dup_idx].get("notes") or [])
            if not any("similar" in n.lower() or "limited" in n.lower() for n in notes):
                notes.append("Similar style combination — limited wardrobe variety.")
            result[dup_idx]["notes"] = notes

    return result


# ---------------------------------------------------------------------------
# Outfit completeness validator
# ---------------------------------------------------------------------------

def _is_complete_outfit(
    item_ids: List[str],
    id_to_item: Dict[str, Any],
) -> bool:
    """
    Return True if the outfit has a valid wearable core:
      - (top AND bottom) together, OR
      - a dress alone (self-contained)

    Outfits missing a top, missing a bottom (and having no dress), or containing
    only shoes/outerwear/accessories are incomplete and must not be surfaced.
    This catches bottom-only or top-only LLM slots and single-item fallbacks.
    """
    has_top = has_bottom = has_dress = False
    for iid in item_ids:
        item = id_to_item.get(iid)
        if not item:
            continue
        cat = _normalize_category(item.get("profile"))
        if cat == "top":
            has_top = True
        elif cat == "bottom":
            has_bottom = True
        elif cat == "dress":
            has_dress = True
    return has_dress or (has_top and has_bottom)


def _filter_complete_outfits(
    outfits: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Remove outfits that are missing a required core piece (top or bottom).
    Returns fewer outfits rather than surfacing incomplete suggestions.
    """
    id_to_item: Dict[str, Any] = {str(it.get("id")): it for it in items}
    return [
        o for o in outfits
        if _is_complete_outfit(o.get("itemIds") or [], id_to_item)
    ]


# ---------------------------------------------------------------------------
# Duplicate-honesty post-processor
# ---------------------------------------------------------------------------

def _mark_duplicates(outfits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scan the final outfit list and overwrite notes (and why) for any entry
    whose itemIds set is identical to a previously seen outfit.

    Catches LLM-fabricated variety: the LLM may return 3 outfits with
    identical IDs but different names ("Casual Comfort", "Laid-back Look")
    to disguise repetition. This post-processor ensures honest messaging
    regardless of which code path generated the outfits.
    Normal unique outfits are not affected.
    """
    seen: Set[frozenset] = set()
    result = []
    for outfit in outfits:
        id_set = frozenset(outfit.get("itemIds") or [])
        if id_set and id_set in seen:
            result.append({
                "itemIds": outfit["itemIds"],
                "why": "Same combination repeated — limited wardrobe options available.",
                "notes": ["Limited wardrobe — fewer unique combinations available."],
            })
        else:
            seen.add(id_set)
            result.append(outfit)
    return result


# ---------------------------------------------------------------------------
# Wardrobe shortlist for LLM (Phase 2: latency reduction)
# ---------------------------------------------------------------------------

_LLM_CATEGORY_LIMITS: Dict[str, int] = {
    "top":      5,
    "bottom":   5,
    "shoes":    3,
    "outerwear":2,
    "dress":    3,
    "other":    2,
}


def _shortlist_for_llm(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Cap each clothing category to a small limit before sending to the LLM.

    Keeps total prompt size to ~18 items so token count stays predictable and
    OpenAI response latency stays well under the 20 s Python timeout.
    Within each category, items with richer profile data (type, pairingHints,
    primaryColor) are preferred so the LLM gets the best-context candidates.
    Never returns empty if items is non-empty.
    """
    by_cat: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        cat = _normalize_category(it.get("profile"))
        by_cat.setdefault(cat, []).append(it)

    def _richness(item: Dict[str, Any]) -> int:
        p = item.get("profile") or {}
        return (
            (2 if p.get("type") else 0)
            + (1 if p.get("pairingHints") else 0)
            + (1 if p.get("primaryColor") else 0)
        )

    result: List[Dict[str, Any]] = []
    for cat, limit in _LLM_CATEGORY_LIMITS.items():
        group = sorted(by_cat.get(cat, []), key=_richness, reverse=True)
        result.extend(group[:limit])

    return result if result else items


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def generate_outfits(
    items: List[Dict[str, Any]],
    occasion: Optional[str] = None,
    location: Optional[Dict[str, Any]] = None,
    weather: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Generate up to 3 outfits (itemIds, why, notes). No images, no Vision.

    Steps:
    1. Normalise location/weather to plain dicts.
    2. Pre-filter items for weather suitability (heavy coats out in heat).
    3. Try OpenAI TEXT model with structured slot-based fashion prompt
       (formal, color, pattern, material, pairingHints, and variety rules).
    4. Fall back to deterministic scoring + diversity selection.
    """
    if not items:
        return []

    use_llm = True
    if os.getenv("AI_ENABLE", "").lower() in ("false", "0", "no"):
        use_llm = False
    if os.getenv("ENABLE_LLM", "").lower() in ("false", "0", "no"):
        use_llm = False

    loc_dict = None
    if location is not None and hasattr(location, "model_dump"):
        loc_dict = location.model_dump()
    elif isinstance(location, dict):
        loc_dict = location

    weather_dict = None
    if weather is not None and hasattr(weather, "model_dump"):
        weather_dict = weather.model_dump()
    elif isinstance(weather, dict):
        weather_dict = weather

    temp_f: Optional[float] = None
    if weather_dict and isinstance(weather_dict.get("tempF"), (int, float)):
        temp_f = float(weather_dict["tempF"])

    # Step 1: remove weather-inappropriate items before LLM sees them
    filtered_items = _weather_pre_filter(items, temp_f)

    # Step 2: LLM with structured prompt (formal + color + pattern + material + variety).
    # _mark_duplicates applied so LLM-fabricated variety (same itemIds, different titles)
    # is replaced with an honest limited-wardrobe message.
    if use_llm and (os.getenv("OPENAI_API_KEY") or "").strip():
        # Phase 2: cap items sent to LLM to keep prompt small and latency low.
        llm_items = _shortlist_for_llm(filtered_items)
        out = _call_openai_text(llm_items, occasion, loc_dict, weather_dict)
        if out:
            out = _near_duplicate_check(out, llm_items, occasion, weather_dict)
            out = _filter_complete_outfits(out, llm_items)
            # Backfill: if completeness filtering dropped us below 3, pad with
            # deterministic outfits (from the full filtered set) so callers
            # consistently receive 3 outfits rather than 1 or 2.
            if len(out) < 3:
                det_pad = _deterministic_outfits(filtered_items, occasion, weather_dict)
                det_pad = _filter_complete_outfits(det_pad, filtered_items)
                seen = {frozenset(o.get("itemIds") or []) for o in out}
                for candidate in det_pad:
                    if len(out) >= 3:
                        break
                    if frozenset(candidate.get("itemIds") or []) not in seen:
                        out.append(candidate)
            return _mark_duplicates(out)

    # Step 3: deterministic fallback with full scoring + diversity selection.
    # _select_diverse_outfits already enforces fingerprint diversity here;
    # _mark_duplicates is a final safety net for exact-ID duplicates.
    # Completeness filter applied here too — guards the single-item fallback path.
    det = _deterministic_outfits(filtered_items, occasion, weather_dict)
    det = _filter_complete_outfits(det, filtered_items)
    return _mark_duplicates(det)
