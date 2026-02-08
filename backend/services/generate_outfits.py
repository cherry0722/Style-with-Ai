# services/generate_outfits.py
# Phase 3C: Text-only outfit generation. No images, no Vision, no RAG.
# Uses ONLY request.items[].profile and context (occasion, location, weather).
import os
import json
from typing import List, Dict, Any, Optional

RESPONSE_SCHEMA = """
{
  "outfits": [
    {
      "itemIds": ["<id1>", "<id2>", "<id3>"],
      "why": "One sentence explanation.",
      "notes": ["Optional note 1", "Optional note 2"]
    }
  ]
}
"""


def _normalize_category(profile: Optional[Dict[str, Any]]) -> str:
    """Map item profile to category: top, bottom, shoes, dress, outerwear, other."""
    if not profile:
        return "other"
    c = (profile.get("category") or profile.get("type") or "").lower()
    t = (profile.get("type") or "").lower()
    s = f"{c} {t}"
    if c in ("top", "tops") or any(x in t for x in ("shirt", "tee", "blouse", "sweater", "hoodie", "polo")):
        return "top"
    if c in ("bottom", "bottoms") or any(x in t for x in ("pants", "jeans", "chinos", "shorts", "skirt")):
        return "bottom"
    if c in ("shoes", "shoe") or any(x in t for x in ("sneaker", "boot", "loafer", "heel", "sandal")):
        return "shoes"
    if c == "dress" or "dress" in t:
        return "dress"
    if c == "outerwear" or any(x in t for x in ("jacket", "coat", "blazer", "cardigan", "overcoat")):
        return "outerwear"
    return "other"


def _deterministic_outfits(
    items: List[Dict[str, Any]],
    occasion: Optional[str],
    weather: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Build up to 3 outfits by category (top/bottom/shoes, dress/shoes, optional outerwear). No images."""
    by_cat: Dict[str, List[Dict[str, Any]]] = {"top": [], "bottom": [], "shoes": [], "dress": [], "outerwear": [], "other": []}
    for it in items:
        cat = _normalize_category(it.get("profile"))
        if cat in by_cat:
            by_cat[cat].append(it)
        else:
            by_cat["other"].append(it)

    tops = by_cat["top"]
    bottoms = by_cat["bottom"]
    shoes = by_cat["shoes"]
    dresses = by_cat["dress"]
    outerwear = by_cat["outerwear"]

    occasion_str = (occasion or "casual").lower()
    temp_f = None
    if weather and isinstance(weather.get("tempF"), (int, float)):
        temp_f = float(weather["tempF"])
    weather_note = ""
    if temp_f is not None:
        if temp_f < 50:
            weather_note = "Suitable for cool weather."
        elif temp_f < 75:
            weather_note = "Good for mild temperatures."
        else:
            weather_note = "Light and suitable for warm weather."

    outfits: List[Dict[str, Any]] = []

    # 1) Full: top + bottom + shoes
    for t in tops[:3]:
        for b in bottoms[:3]:
            for s in shoes[:2]:
                ids = [t["id"], b["id"], s["id"]]
                why = f"Complete outfit for {occasion_str}. Top, bottom, and shoes. {weather_note}".strip()
                outfits.append({"itemIds": ids, "why": why, "notes": ["Balanced categories."]})
                if len(outfits) >= 3:
                    return outfits[:3]

    # 2) Top + bottom (no shoes)
    for t in tops[:3]:
        for b in bottoms[:3]:
            ids = [t["id"], b["id"]]
            why = f"Top and bottom for {occasion_str}. Add shoes to complete. {weather_note}".strip()
            outfits.append({"itemIds": ids, "why": why, "notes": ["Shoes missing."]})
            if len(outfits) >= 3:
                return outfits[:3]

    # 3) Dress + shoes
    for d in dresses[:2]:
        for s in shoes[:2]:
            ids = [d["id"], s["id"]]
            why = f"Dress and shoes for {occasion_str}. {weather_note}".strip()
            outfits.append({"itemIds": ids, "why": why, "notes": []})
            if len(outfits) >= 3:
                return outfits[:3]
    for d in dresses[:2]:
        outfits.append({"itemIds": [d["id"]], "why": f"Dress for {occasion_str}. Add shoes. {weather_note}".strip(), "notes": ["Shoes missing."]})
        if len(outfits) >= 3:
            return outfits[:3]

    # 4) Single items as fallback
    for it in items:
        if len(outfits) >= 3:
            break
        pid = it.get("id")
        if not pid:
            continue
        profile = it.get("profile") or {}
        color = (profile.get("primaryColor") or "").strip() or "neutral"
        why = f"Single item for {occasion_str}. {color} tone. {weather_note}".strip()
        outfits.append({"itemIds": [pid], "why": why, "notes": ["Add more pieces to complete the look."]})

    return outfits[:3]


def _call_openai_text(
    items: List[Dict[str, Any]],
    occasion: Optional[str],
    location: Optional[Dict[str, Any]],
    weather: Optional[Dict[str, Any]],
) -> Optional[List[Dict[str, Any]]]:
    """Call OpenAI TEXT model only. No images. Returns list of outfit dicts or None on failure."""
    try:
        from openai import OpenAI
    except ImportError:
        return None

    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        return None

    # Item summaries: id + profile fields only (no image URLs, no raw bytes)
    item_summaries = []
    for it in items:
        pid = it.get("id") or ""
        profile = it.get("profile") or {}
        item_summaries.append({
            "id": pid,
            "category": profile.get("category"),
            "type": profile.get("type"),
            "primaryColor": profile.get("primaryColor"),
            "formality": profile.get("formality"),
            "season": profile.get("season"),
            "styleTags": profile.get("styleTags", []),
        })

    context = {
        "occasion": occasion or "casual",
        "location": location,
        "weather": weather,
    }

    system = """You are an outfit recommender. You receive a list of wardrobe items (id + metadata only) and context (occasion, location, weather).
Output STRICT JSON only. No markdown, no code fence, no explanation outside JSON.
Schema: """ + RESPONSE_SCHEMA.strip() + """
Rules:
- Use only the item "id" values from the input; do not invent IDs.
- Return exactly 3 outfits when possible; fewer only if fewer than 3 valid combinations exist.
- Each outfit must have "itemIds" (array of strings), "why" (one sentence), "notes" (array of strings, can be empty).
- Do not reference any images or URLs. Refer only to categories, colors, formality, occasion, weather."""

    user = f"Context: {json.dumps(context)}\n\nItems: {json.dumps(item_summaries)}\n\nReturn JSON with key \"outfits\" (array of 3 outfits when possible)."

    try:
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=800,
            response_format={"type": "json_object"},
        )
        raw = (resp.choices[0].message.content or "").strip()
        if not raw:
            return None
        data = json.loads(raw)
        outfits = data.get("outfits")
        if not isinstance(outfits, list):
            return None
        result = []
        valid_ids = {str(it.get("id")) for it in items}
        for o in outfits[:3]:
            if not isinstance(o, dict):
                continue
            item_ids = o.get("itemIds") or o.get("itemIds") or []
            item_ids = [str(i) for i in item_ids if str(i) in valid_ids]
            why = (o.get("why") or "").strip() or "Outfit combination."
            notes = o.get("notes")
            if not isinstance(notes, list):
                notes = []
            notes = [str(n).strip() for n in notes if n]
            result.append({"itemIds": item_ids, "why": why, "notes": notes})
        return result if result else None
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(f"[generate_outfits] OpenAI JSON error: {e}")
        return None
    except Exception as e:
        print(f"[generate_outfits] OpenAI call failed: {e}")
        return None


def generate_outfits(
    items: List[Dict[str, Any]],
    occasion: Optional[str] = None,
    location: Optional[Dict[str, Any]] = None,
    weather: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Generate up to 3 outfits (itemIds, why, notes).
    If OPENAI_API_KEY present and AI_ENABLE/ENABLE_LLM not false: use OpenAI TEXT model.
    Else: deterministic fallback by category.
    No images, no Vision.
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

    if use_llm and (os.getenv("OPENAI_API_KEY") or "").strip():
        out = _call_openai_text(items, occasion, loc_dict, weather_dict)
        if out:
            return out

    return _deterministic_outfits(items, occasion, weather_dict)
