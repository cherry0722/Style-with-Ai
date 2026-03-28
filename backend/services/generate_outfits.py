# services/generate_outfits.py
# Phase 3C+: Text-only outfit generation with structured fashion reasoning.
# Uses ONLY request.items[].profile and context (occasion, location, weather).
#
# Pipeline:
#   1. _weather_pre_filter      — remove weather-inappropriate items before LLM
#   2. _call_openai_text        — LLM reasons in slotted schema (top/bottom/footwear/layer)
#                                 with explicit formal + color rules in system prompt;
#                                 maps back to the existing itemIds/why/notes contract
#   3. _deterministic_outfits   — fallback with occasion-compatibility + color-harmony scoring

import os
import json
from typing import List, Dict, Any, Optional, Set

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
    Stronger clash detection than before.
    Clashes detected:
    - Two bold warm hues together (red+orange, orange+yellow, red+pink, etc.)
    - One side being neutral always prevents a clash.

    This catches the red+orange and orange+yellow cases that were missed.
    """
    if not color_a or not color_b:
        return False
    a, b = color_a.lower(), color_b.lower()
    # Neutrals pair with everything — no clash possible
    if _is_neutral(a) or _is_neutral(b):
        return False
    a_warm = any(w in a for w in WARM_COLORS)
    b_warm = any(w in b for w in WARM_COLORS)
    # Two bold warm colors = likely clash (e.g. red+orange, orange+yellow, red+pink)
    return a_warm and b_warm


def _color_pair_score(color_top: Optional[str], color_bottom: Optional[str]) -> int:
    """
    Score a top+bottom color pairing.
      +2  → neutral base (safe pairing)
       0  → no clash but no neutral either (acceptable)
      -2  → strong clash (penalize heavily so it sinks to the bottom of the sort)

    Using -2 instead of the previous -1 makes the penalty strong enough to
    consistently avoid clashing combos when neutral alternatives exist.
    """
    if _colors_clash(color_top, color_bottom):
        return -2   # strong penalty — avoids clash when better option exists
    if _is_neutral(color_top) or _is_neutral(color_bottom):
        return 2    # neutral base is always safe
    return 0        # non-neutral, non-clashing — acceptable but not preferred


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
    Used to re-rank tops, bottoms, and shoes before combo generation so that
    dress shirts and trousers float to the top and t-shirts/sneakers sink.

      +2  → clearly formal (dress shirt, trousers, loafers, blazer)
       0  → neutral / unknown
      -2  → clearly casual (t-shirt, sneakers, sweatpants)

    Items with a high Vision formality score (>= 7) get a bonus; low (<= 3) get a penalty.
    The -2 penalty is strong enough to de-rank casual items without hiding them
    entirely — they remain as a last-resort fallback if no formal options exist.
    """
    profile = item.get("profile") or {}
    item_type = (profile.get("type") or "").lower()
    formality_val = profile.get("formality")  # 0–10 int from Vision

    score = 0

    # --- Top compatibility ---
    if any(kw in item_type for kw in FORMAL_TOP_KEYWORDS):
        score += 2
    elif any(kw in item_type for kw in CASUAL_TOP_KEYWORDS):
        score -= 2

    # --- Bottom compatibility ---
    if any(kw in item_type for kw in FORMAL_BOTTOM_KEYWORDS):
        score += 2
    elif any(kw in item_type for kw in CASUAL_BOTTOM_KEYWORDS):
        score -= 2

    # --- Shoe compatibility ---
    if any(kw in item_type for kw in FORMAL_SHOE_KEYWORDS):
        score += 2
    elif any(kw in item_type for kw in CASUAL_SHOE_KEYWORDS):
        score -= 2

    # --- Outerwear/layer compatibility ---
    if any(kw in item_type for kw in FORMAL_LAYER_KEYWORDS):
        score += 2

    # --- Vision formality field: use as a tiebreaker ---
    if formality_val is not None:
        try:
            f = int(formality_val)
            if f >= 7:
                score += 1   # Vision agrees this is formal
            elif f <= 3:
                score -= 1   # Vision agrees this is casual
        except (ValueError, TypeError):
            pass

    return score


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
# Weather pre-filter
# ---------------------------------------------------------------------------

def _weather_pre_filter(
    items: List[Dict[str, Any]],
    temp_f: Optional[float],
) -> List[Dict[str, Any]]:
    """
    Remove weather-inappropriate items BEFORE the LLM call.
    Rules:
    - Hot (>= 80 °F): exclude heavy outerwear (jackets, coats, hoodies, cardigans).
    - Cold (<= 45 °F): keep everything; the LLM/fallback adds layers naturally.
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

        # Exclude heavy outer layers when it's hot
        if temp_f >= 80 and category == "outerwear":
            if any(kw in item_type for kw in HEAVY_LAYER_KEYWORDS | {"hoodie", "cardigan"}):
                continue

        filtered.append(it)

    return filtered if filtered else items


# ---------------------------------------------------------------------------
# Internal LLM schema
# ---------------------------------------------------------------------------
# The LLM reasons in SLOTS (top / bottom / footwear / layer) to force thinking
# about outfit completeness and compatibility.
# Results map back to the existing itemIds/why/notes API contract.

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
      "reasoning": "1-2 sentences: why this outfit works — color harmony, occasion fit, weather suitability."
    }
  ]
}"""


# ---------------------------------------------------------------------------
# LLM item summary builder
# ---------------------------------------------------------------------------

def _build_item_summary(it: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build a rich item summary for the LLM prompt.
    Includes all profile fields relevant to outfit reasoning.
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
        "keyDetails": profile.get("keyDetails") or [],
        "pairingHints": profile.get("pairingHints") or [],
    }


# ---------------------------------------------------------------------------
# OpenAI TEXT call (structured reasoning)
# ---------------------------------------------------------------------------

def _build_system_prompt(occasion: Optional[str]) -> str:
    """
    Build the LLM system prompt, injecting a stronger formal rule when
    the occasion is formal. This is the primary fix for the 'dress shirt +
    trousers + white sneakers' problem — the LLM now knows sneakers are
    prohibited on formal occasions when alternatives exist.
    """
    formal = _is_formal_occasion(occasion)

    # --- Base quality rules (always present) ---
    base = (
        "You are a professional fashion stylist AI. "
        "Generate realistic, wearable, stylish outfits using ONLY the provided wardrobe items. "
        "Do NOT invent items or use IDs not in the list.\n\n"
        "Quality rules:\n"
        "1. OCCASION — match formality level to occasion. "
        "Casual = formality 0–5. Office/work = 6+. Date night = 7+. Formal/gala/wedding = 8+. Gym = athletic.\n"
        "2. WEATHER — if tempF >= 80 °F, never assign a heavy jacket/coat/hoodie to the layer slot. "
        "If tempF <= 50 °F, strongly prefer adding an outerwear layer when one is available.\n"
        "3. COLOR HARMONY — prefer a neutral base (black, white, navy, grey, beige, charcoal) "
        "paired with at most one accent color. "
        "NEVER pair two bold warm colors together (e.g., red + orange, orange + yellow, red + pink). "
        "If a neutral top exists, prefer it over a bold top that would clash with the available bottoms. "
        "Use pairingHints from the item profile when available.\n"
        "4. COMPLETENESS — a minimum viable outfit needs top + bottom OR a dress. "
        "Footwear improves any look. A layer slot is optional.\n"
        "5. VARIETY — the 3 outfits must each use a meaningfully different combination of items.\n"
    )

    # --- Injected formal rule (only when occasion is formal) ---
    formal_rule = ""
    if formal:
        formal_rule = (
            "6. FORMAL OCCASIONS (CRITICAL) — The requested occasion is formal. "
            "You MUST follow these rules strictly:\n"
            "   a. Top slot: use dress shirts, button-up shirts, Oxford shirts, blouses, or turtlenecks. "
            "NEVER use t-shirts, hoodies, graphic tees, or polo shirts if a formal top is available.\n"
            "   b. Bottom slot: use trousers, dress pants, slacks, or tailored pants. "
            "NEVER use casual jeans, sweatpants, or shorts if formal bottoms are available.\n"
            "   c. Footwear slot: use loafers, derbies, Oxford shoes, heels, monk straps, or Chelsea boots. "
            "NEVER use sneakers, trainers, or canvas shoes if formal footwear is available.\n"
            "   d. Layer slot (if used): use a blazer, suit jacket, or sport coat — not a hoodie.\n"
            "   e. If only casual items exist, use the least-casual option available and note the limitation.\n"
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
    1. Build rich item summaries (all styling-relevant profile fields).
    2. Use slotted schema prompt — forces reasoning about completeness, formality,
       and color compatibility rather than arbitrary ID picking.
    3. Validate all slot assignments reference real item IDs.
    4. Map structured response → existing API contract:
         slot ids         → itemIds
         reasoning        → why
         name + occasion  → notes

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

            # Accept legacy flat itemIds format as fallback (backward compat)
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
# Deterministic fallback
# ---------------------------------------------------------------------------

def _deterministic_outfits(
    items: List[Dict[str, Any]],
    occasion: Optional[str],
    weather: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Fallback outfit builder when OpenAI is unavailable.

    Improvements:
    - Formal occasion compatibility: tops/bottoms/shoes are sorted by
      _formal_compatibility_score so dress shirts and trousers float to the top
      and t-shirts/sneakers sink — matching the LLM formal rule.
    - Stronger color-harmony scoring: penalty is -2 (was -1), and WARM_COLORS
      now includes pink/yellow so more clashes are caught.
    - Duplicate handling: prefers unique combos; if wardrobe is too small for
      3 unique combos, pads honestly with a "Limited wardrobe" note rather than
      silently repeating or pretending the outfits are meaningfully different.
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

    # Hot weather: drop outerwear (mirrors LLM rule)
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

    # --- Formal sorting ---
    # When the occasion is formal, sort each category so formal-compatible items
    # (dress shirts, trousers, loafers) appear first. Casual items (sneakers,
    # t-shirts) sink to the bottom but remain available as a last resort.
    if is_formal:
        tops = sorted(tops, key=lambda x: -_formal_compatibility_score(x))
        bottoms = sorted(bottoms, key=lambda x: -_formal_compatibility_score(x))
        shoes = sorted(shoes, key=lambda x: -_formal_compatibility_score(x))
        outerwear = sorted(outerwear, key=lambda x: -_formal_compatibility_score(x))

    # --- Color-harmony scoring for top+bottom pairs ---
    # Sorted best-first: neutral-base pairs (+2) > acceptable pairs (0) > clashing pairs (-2).
    # The stronger -2 penalty (vs previous -1) ensures clashing combos are consistently
    # ranked below neutral alternatives when they exist.
    def _pair_color_score(top_item: Dict, bottom_item: Dict) -> int:
        tc = (top_item.get("profile") or {}).get("primaryColor")
        bc = (bottom_item.get("profile") or {}).get("primaryColor")
        return _color_pair_score(tc, bc)

    combos = sorted(
        [(t, b) for t in tops[:4] for b in bottoms[:4]],
        key=lambda tb: -_pair_color_score(tb[0], tb[1]),
    )

    outfits: List[Dict[str, Any]] = []
    # Track unique item-set fingerprints (frozenset so order doesn't matter)
    used_sets: Set[frozenset] = set()

    # 1) Full outfit: top + bottom + shoes (+ cold-weather layer)
    for t, b in combos:
        for s in shoes[:3]:
            ids = [t["id"], b["id"], s["id"]]
            layer_note = ""

            if temp_f is not None and temp_f <= 54 and outerwear:
                ids.append(outerwear[0]["id"])
                layer_note = " Layered for warmth."

            id_set = frozenset(ids)
            if id_set in used_sets:
                continue
            used_sets.add(id_set)

            tc = (t.get("profile") or {}).get("primaryColor", "")
            bc = (b.get("profile") or {}).get("primaryColor", "")
            color_note = f"{tc} top with {bc} bottom. " if tc and bc else ""

            why = f"{color_note}Complete outfit for {occasion_str}. {weather_note}{layer_note}".strip()
            notes = ["Formal combination." if is_formal else "Color-matched combination."]
            outfits.append({"itemIds": ids, "why": why, "notes": notes})
            if len(outfits) >= 3:
                return outfits

    # 2) Top + bottom (no shoes in wardrobe)
    for t, b in combos:
        ids = [t["id"], b["id"]]
        id_set = frozenset(ids)
        if id_set in used_sets:
            continue
        used_sets.add(id_set)
        why = f"Top and bottom for {occasion_str}. Add shoes to complete. {weather_note}".strip()
        outfits.append({"itemIds": ids, "why": why, "notes": ["Shoes missing."]})
        if len(outfits) >= 3:
            return outfits

    # 3) Dress + shoes
    for d in dresses[:2]:
        for s in shoes[:2]:
            ids = [d["id"], s["id"]]
            id_set = frozenset(ids)
            if id_set in used_sets:
                continue
            used_sets.add(id_set)
            why = f"Dress and shoes for {occasion_str}. {weather_note}".strip()
            outfits.append({"itemIds": ids, "why": why, "notes": []})
            if len(outfits) >= 3:
                return outfits
    for d in dresses[:2]:
        ids = [d["id"]]
        if frozenset(ids) not in used_sets:
            used_sets.add(frozenset(ids))
            outfits.append({
                "itemIds": ids,
                "why": f"Dress for {occasion_str}. Add shoes. {weather_note}".strip(),
                "notes": ["Shoes missing."],
            })
            if len(outfits) >= 3:
                return outfits

    # 4) Single-item fallback
    for it in items:
        if len(outfits) >= 3:
            break
        pid = it.get("id")
        if not pid or frozenset([pid]) in used_sets:
            continue
        used_sets.add(frozenset([pid]))
        profile = it.get("profile") or {}
        color = (profile.get("primaryColor") or "neutral").strip()
        why = f"Single item for {occasion_str}. {color} tone. {weather_note}".strip()
        outfits.append({"itemIds": [pid], "why": why, "notes": ["Add more pieces to complete the look."]})

    # --- Duplicate padding ---
    # If the wardrobe is too small to produce 3 unique combinations, pad honestly
    # rather than silently omitting outfits or fabricating variety.
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
# Duplicate-honesty post-processor
# ---------------------------------------------------------------------------

def _mark_duplicates(outfits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scan the final outfit list and overwrite notes (and why) for any entry
    whose itemIds set is identical to a previously seen outfit.

    This catches two cases:
    - LLM returns 3 outfits that map to the same items but uses different
      slot names / titles to disguise the repetition ("Casual Comfort",
      "Laid-back Look", "Chill Day Outfit" all with identical IDs).
    - Deterministic padding already writes honest notes, but this acts as a
      safety net for any future path.

    Normal unique outfits are not affected — only true duplicates are touched.
    """
    seen: Set[frozenset] = set()
    result = []
    for outfit in outfits:
        id_set = frozenset(outfit.get("itemIds") or [])
        if id_set and id_set in seen:
            # Duplicate detected — replace notes with an honest message and
            # strip the why so the response doesn't imply meaningful variety.
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
       (formal rule injected when occasion is formal).
    4. Fall back to deterministic category + formal-compatibility + color-harmony matching.
    """
    if not items:
        return []

    # Respect kill switches
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

    # Step 2: LLM with structured formal + color-harmony prompt.
    # _mark_duplicates is applied so LLM-fabricated variety (same itemIds,
    # different titles) is replaced with an honest limited-wardrobe message.
    if use_llm and (os.getenv("OPENAI_API_KEY") or "").strip():
        out = _call_openai_text(filtered_items, occasion, loc_dict, weather_dict)
        if out:
            return _mark_duplicates(out)

    # Step 3: deterministic fallback with formal + color-harmony scoring.
    # _mark_duplicates acts as a safety net here too, even though the fallback
    # already pads with honest notes — this keeps both paths consistent.
    return _mark_duplicates(_deterministic_outfits(filtered_items, occasion, weather_dict))
