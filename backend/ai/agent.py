# ai/agent.py
from typing import Dict, Any, Optional, List, Tuple
import os
import logging
from urllib.parse import urlparse

# Set up logger for this module
logger = logging.getLogger(__name__)

from db.mongo import get_db, get_user_profile, get_user_wardrobe, get_items_by_ids
from calendar_helper import get_events_for_today
from ai.preference import PreferenceScorer
from ai.rag_engine import suggest_with_rag
from schemas.models import RecommendRequest, RecommendResponse, SuggestRequest, WardrobeItem

# LLM opt-in toggle - gracefully fallback if not enabled
USE_LLM = os.getenv('ENABLE_LLM', 'false').lower() == 'true' or os.getenv('OPENAI_API_KEY') is not None
try:
    from .graph.graph import run_graph
except Exception:
    run_graph = None

# Module-level DB instance
db = get_db()


# ============================================================================
# Wardrobe Filtering Helpers (Phase 4D)
# ============================================================================

def _is_local_host(host: str) -> bool:
    """
    Check if a host string represents a local-only host.
    Returns True for localhost, localhost with port, or 192.168.* IPs.
    """
    if not host:
        return False
    
    host_lower = host.lower().strip()
    
    # Check for localhost
    if host_lower == "localhost" or host_lower.startswith("localhost:"):
        return True
    
    # Check for 192.168.* IP addresses
    if host_lower.startswith("192.168."):
        return True
    
    # Check for 127.0.0.1
    if host_lower.startswith("127.0.0.1") or host_lower == "127.0.0.1":
        return True
    
    return False


def _is_dummy_image(image_url: str) -> bool:
    """
    Check if an image URL points to an obviously dummy/placeholder image.
    """
    if not image_url:
        return True
    
    image_url_lower = image_url.lower()
    
    # Check for common placeholder patterns
    dummy_patterns = [
        "your_image_here",
        "placeholder",
        "dummy",
        "sample",
        "example",
        "test_image",
        "no_image",
        "image_coming_soon",
    ]
    
    for pattern in dummy_patterns:
        if pattern in image_url_lower:
            return True
    
    return False


def _is_valid_category(category: Optional[str]) -> bool:
    """
    Check if a category is valid for AI outfit selection.
    Only allows: "top", "bottom", "shoes".
    """
    if not category:
        return False
    
    category_lower = category.lower().strip()
    allowed_categories = ["top", "bottom", "shoes"]
    
    return category_lower in allowed_categories


def _is_usable_item(item_dict: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Check if a wardrobe item dictionary is usable for AI outfit selection.
    Returns (is_usable, reason_if_not_usable).
    
    Rules:
    - Must have a valid category (top, bottom, shoes)
    - Must have a non-empty imageUrl
    - imageUrl must not be a localhost/local IP
    - imageUrl must not be a dummy/placeholder image
    """
    # Check category
    category = item_dict.get("category")
    if not _is_valid_category(category):
        return (False, "invalid_category")
    
    # Check imageUrl
    image_url = item_dict.get("imageUrl") or item_dict.get("image_url")
    if not image_url or not isinstance(image_url, str) or not image_url.strip():
        return (False, "missing_image_url")
    
    # Check for dummy/placeholder images
    if _is_dummy_image(image_url):
        return (False, "dummy_image")
    
    # Check host
    try:
        parsed = urlparse(image_url)
        host = parsed.netloc or parsed.hostname
        
        if not host:
            # Relative URL or malformed
            return (False, "invalid_url")
        
        if _is_local_host(host):
            return (False, "host_local")
    
    except Exception:
        # Invalid URL format
        return (False, "invalid_url")
    
    # All checks passed
    return (True, None)


def filter_usable_items(raw_items: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Filter wardrobe items to only include usable items for AI outfit selection.
    
    Args:
        raw_items: List of wardrobe item dictionaries from MongoDB
    
    Returns:
        Tuple of (usable_items, stats):
        - usable_items: List of filtered item dictionaries
        - stats: Dictionary with filtering statistics
    """
    total_count = len(raw_items)
    usable_items = []
    ignored_by_reason: Dict[str, int] = {}
    counts_by_category: Dict[str, int] = {}
    
    for item in raw_items:
        is_usable, reason = _is_usable_item(item)
        
        if is_usable:
            usable_items.append(item)
            # Count by category
            category = (item.get("category") or "unknown").lower()
            counts_by_category[category] = counts_by_category.get(category, 0) + 1
        else:
            # Track ignored items by reason
            reason_key = reason or "unknown"
            ignored_by_reason[reason_key] = ignored_by_reason.get(reason_key, 0) + 1
    
    stats = {
        "total_count": total_count,
        "usable_count": len(usable_items),
        "counts_by_category": counts_by_category,
        "ignored_by_reason": ignored_by_reason,
    }
    
    return (usable_items, stats)


class MyraAgent:
    """
    Orchestrator for MYRA:
      - Loads wardrobe and user profile
      - Applies preference-aware reranking
      - Calls RAG+LLM to get outfits
    """
    
    def __init__(self):
        """Initialize agent with DB instance."""
        self.db = db
    
    def _categorize_item(self, item: WardrobeItem) -> str:
        """
        Rough category classification: top, bottom, shoe, jacket, other.
        Uses item.category, item.type (from metadata), and tags as hints.
        Prioritizes metadata.type for more accurate classification.
        """
        cat = (item.category or "").lower()
        item_type = (item.type or "").lower()
        tags = [t.lower() for t in (item.tags or [])]
        
        # Check metadata.type first, then category, then tags
        check_str = f"{item_type} {cat} {' '.join(tags)}".lower()

        # Jackets / outerwear (check first to catch hoodies/sweaters that might be categorized as tops)
        jacket_keywords = ["hoodie", "sweater", "jacket", "coat", "blazer", "overcoat", "cardigan"]
        if any(k in check_str for k in jacket_keywords):
            return "jacket"

        # Tops
        top_keywords = ["top", "tshirt", "t-shirt", "shirt", "blouse", "polo", "tank", "camisole"]
        if any(k in check_str for k in top_keywords):
            return "top"

        # Bottoms
        bottom_keywords = ["jeans", "pants", "trousers", "skirt", "shorts", "bottom", "leggings"]
        if any(k in check_str for k in bottom_keywords):
            return "bottom"

        # Shoes
        shoe_keywords = ["shoe", "sneaker", "boot", "heel", "sandal", "slide", "loafer", "slipper"]
        if any(k in check_str for k in shoe_keywords):
            return "shoe"

        return "other"

    def _score_item(
        self,
        item: WardrobeItem,
        preferences: Optional[Dict[str, Any]],
        temp_f: Optional[float],
        weather: Optional[Dict[str, Any]] = None
    ) -> Tuple[float, Dict[str, float]]:
        """
        Preference + weather scoring for an item.
        Returns the final numeric score and a breakdown dict for logging.
        """
        weather_dict = weather or {}
        pref_scores = self.score_item_preferences(item, preferences)
        weather_bonus = self._score_item_weather(item, temp_f, weather_dict)
        
        total_score = pref_scores["total"] + weather_bonus
        components = {
            "total": total_score,
            "occasion": pref_scores["occasion"],
            "style": pref_scores["style"],
            "favorite": pref_scores["favorite"],
            "avoid_penalty": pref_scores["avoid_penalty"],
            "weather": weather_bonus,
        }
        return total_score, components

    def _describe_item(self, item: WardrobeItem) -> str:
        """
        Generate a human-readable description of an item for the 'why' explanation.
        Uses metadata.type if available, falls back to category + color.
        """
        item_type = (item.type or "").strip()
        category = (item.category or "").strip()
        color_name = (item.color_name or item.color or "").strip()
        colors = item.colors or []
        
        # Prefer type from metadata if available
        if item_type:
            desc = item_type
            # Add color if available
            if color_name:
                desc = f"{color_name} {desc}"
            elif colors and len(colors) > 0:
                desc = f"{colors[0]} {desc}"
        else:
            # Fallback to category + color
            desc = category if category else "item"
            if color_name:
                desc = f"{color_name} {desc}"
            elif colors and len(colors) > 0:
                desc = f"{colors[0]} {desc}"
        
        # Add descriptive words from style tags if available
        style_tags = item.style_tags or []
        style_words = []
        for tag in ["relaxed", "fitted", "casual", "formal", "comfortable"]:
            if any(t.lower() == tag.lower() for t in style_tags):
                style_words.append(tag)
        
        if style_words:
            desc = f"{style_words[0]} {desc}"
        
        return desc.lower() if desc else "item"

    def score_item_preferences(
        self,
        item: WardrobeItem,
        preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, float]:
        """
        Compute detailed preference scores for a wardrobe item.
        Returns a dict with component scores and total.
        
        Phase 6B: Strong preference-aware scoring.
        
        Scoring rules:
        - occasion_score: +3.0 for exact match in occasionTags, +2.0 if tags contain occasion keyword
        - style_score: +3.0 for exact match in styleVibe, +2.0 if tag contains style keyword
        - favorite_score: +4.0 when prefer_favorites=True and item.isFavorite=True
        - avoid_penalty: -100.0 if item matches any avoided color
        
        Returns:
            Dict with keys: "total", "occasion", "style", "favorite", "avoid_penalty"
        """
        occasion_score = 0.0
        style_score = 0.0
        favorite_score = 0.0
        avoid_penalty = 0.0
        
        if not preferences:
            return {
                "total": 0.0,
                "occasion": occasion_score,
                "style": style_score,
                "favorite": favorite_score,
                "avoid_penalty": avoid_penalty,
            }
        
        item_tags = [tag.lower() for tag in (item.tags or [])]
        occasion_tags = [tag.lower() for tag in (item.occasionTags or [])]
        style_vibe = item.styleVibe
        style_tags = [tag.lower() for tag in (item.style_tags or [])]
        item_color = (item.color or "").lower().strip()
        item_colors = [c.lower().strip() for c in (item.colors or []) if c]
        is_favorite = bool(item.isFavorite)
        
        pref_occasion = preferences.get("occasion")
        pref_style = preferences.get("style_vibe")
        pref_avoid_colors = [c.lower().strip() for c in (preferences.get("avoid_colors") or []) if c]
        pref_fav = bool(preferences.get("prefer_favorites"))
        
        if pref_occasion:
            pref_occ = pref_occasion.lower().strip()
            if pref_occ in occasion_tags:
                occasion_score = 3.0
            elif any(pref_occ in tag or tag in pref_occ for tag in item_tags):
                occasion_score = 2.0
        
        if pref_style:
            pref_style_lower = pref_style.lower().strip()
            if style_vibe:
                if isinstance(style_vibe, list):
                    normalized = " ".join([str(s).lower() for s in style_vibe])
                else:
                    normalized = str(style_vibe).lower()
                if pref_style_lower == normalized:
                    style_score = 3.0
                elif pref_style_lower in normalized:
                    style_score = 2.0
            if style_score == 0.0:
                combined_tags = item_tags + style_tags
                if any(pref_style_lower in tag or tag in pref_style_lower for tag in combined_tags):
                    style_score = 2.0
        
        if pref_fav and is_favorite:
            favorite_score = 4.0
        
        if pref_avoid_colors:
            all_colors = set(filter(None, [item_color] + item_colors))
            if any(color in pref_avoid_colors for color in all_colors):
                avoid_penalty = -100.0
        
        total = occasion_score + style_score + favorite_score + avoid_penalty
        
        return {
            "total": total,
            "occasion": occasion_score,
            "style": style_score,
            "favorite": favorite_score,
            "avoid_penalty": avoid_penalty,
        }

    def _score_item_weather(
        self,
        item: WardrobeItem,
        temp_f: Optional[float],
        weather: Dict[str, Any]
    ) -> float:
        """
        Simple weather-aware adjustments.
        Encourages breathable items in heat, layers in cold, and rain-friendly materials.
        """
        if temp_f is None:
            temp_f = weather.get("tempF")
        if temp_f is None:
            temp_f = weather.get("tempf")
        
        summary = (weather.get("summary") or "").lower()
        category = self._categorize_item(item)
        item_tags = [tag.lower() for tag in (item.tags or [])]
        style_tags = [tag.lower() for tag in (item.style_tags or [])]
        fabric = (item.fabric or "").lower()
        item_type = (item.type or "").lower()
        
        weather_bonus = 0.0
        
        try:
            if temp_f is not None:
                if temp_f >= 85:
                    if category == "jacket" or any(tag in item_tags for tag in ["jacket", "coat", "hoodie"]):
                        weather_bonus -= 2.0
                    if (
                        "minimal" in style_tags
                        or "sporty" in style_tags
                        or (category == "top" and "hoodie" not in item_tags)
                    ):
                        weather_bonus += 1.0
                elif temp_f <= 55:
                    if category == "jacket" or any(tag in item_tags for tag in ["jacket", "coat", "hoodie", "sweater"]):
                        weather_bonus += 2.0
                    if category == "bottom" and ("shorts" in item_type or "short" in item_type):
                        weather_bonus -= 2.0
            if "rain" in summary:
                if category == "shoe" and ("canvas" in fabric or "canvas" in item_tags):
                    weather_bonus -= 1.0
        except Exception as weather_err:
            logger.warning(f"[MyraAgent] Weather scoring failed for item {item.id}: {weather_err}")
            return 0.0
        
        return weather_bonus

    def _rank_items_for_preferences(
        self,
        items: List[WardrobeItem],
        preferences: Optional[Dict[str, Any]]
    ) -> List[WardrobeItem]:
        """
        Return items sorted by preference score (descending),
        keeping the original order for ties (i.e., use a stable sort with score as the key).
        """
        if not preferences:
            return items
        
        # Compute scores and keep original index for stable sorting
        scored_items = []
        for idx, item in enumerate(items):
            score_dict = self.score_item_preferences(item, preferences)
            total_score = score_dict["total"]
            scored_items.append((total_score, idx, item))
        
        # Sort by score descending, then by original index (for stability)
        scored_items.sort(key=lambda x: (-x[0], x[1]))
        
        # Return items in sorted order
        return [item for _, _, item in scored_items]

    def recommend(self, req: RecommendRequest) -> RecommendResponse:
        user_id = req.user_id
        event_text = req.event
        weather = req.weather.dict() if req.weather else None

        # 1) Fetch wardrobe and profile
        wardrobe = get_user_wardrobe(user_id)
        profile = get_user_profile(user_id)

        # 2) Preference-aware rerank (using memory)
        pref = PreferenceScorer(profile)
        # For now we don't have base scores from RAG before this step,
        # we let RAG handle weather, so here base_scores=None.
        ranked = pref.score(wardrobe, base_scores=None)

        # 3) Call RAG engine (GPT-4 selection) with memory-informed candidates
        try:
            rag_result = suggest_with_rag(
                user_id=user_id,
                event_text=event_text,
                weather=weather,
                wardrobe_items=ranked,
            )
        except NotImplementedError:
            # Safety net: if RAG is not implemented, return empty outfits
            rag_result = {"outfits": [], "note": "RAG not implemented"}

        return RecommendResponse(
            outfits=[o for o in rag_result.get("outfits", [])],
            context={"event": event_text, "weather": weather},
            used_memory=bool(profile),
        )

    def suggest_outfit(self, request: SuggestRequest) -> RecommendResponse:
        """
        Selects an outfit using scoring based on wardrobe items, temperature, and favorites.
        Returns both item IDs and rich items_detail, plus a human-readable 'why'.
        """
        user_id = request.user_id
        location = request.location
        weather = request.weather
        
        # Parse preferences from request (Phase 5A)
        preferences = None
        if request.preferences:
            # Convert Pydantic model to dict for easier handling
            prefs_dict = request.preferences.dict() if hasattr(request.preferences, "dict") else request.preferences
            # Remove None values to treat empty dict as no preferences
            if prefs_dict:
                preferences = {k: v for k, v in prefs_dict.items() if v is not None}
                # If all values were None, treat as no preferences
                if not preferences:
                    preferences = None
        
        # Log preferences (Phase 5A)
        logger.info(
            f"[MyraAgent] Preferences: occasion={preferences.get('occasion') if preferences else None}, "
            f"style_vibe={preferences.get('style_vibe') if preferences else None}, "
            f"prefer_favorites={preferences.get('prefer_favorites') if preferences else None}, "
            f"avoid_colors={preferences.get('avoid_colors') if preferences else None}"
        )

        # Fetch wardrobe from DB (returns dicts, convert to WardrobeItem)
        raw_wardrobe_dicts = self.db.get_user_wardrobe(user_id)
        
        # Filter to usable items only (Phase 4D: wardrobe hygiene)
        usable_dicts, hygiene_stats = filter_usable_items(raw_wardrobe_dicts)
        
        # Log wardrobe hygiene stats
        logger.info(
            f"[MyraAgent] Wardrobe hygiene: total={hygiene_stats['total_count']} "
            f"usable={hygiene_stats['usable_count']} "
            f"by_category={hygiene_stats['counts_by_category']} "
            f"ignored={hygiene_stats['ignored_by_reason']}"
        )
        
        # Fallback to raw items if filtering left us with nothing
        if not usable_dicts:
            logger.warning("[MyraAgent] Warning: No usable items after filtering; falling back to raw wardrobe set.")
            usable_dicts = raw_wardrobe_dicts
        
        # Convert usable items to WardrobeItem objects
        wardrobe_items: List[WardrobeItem] = []
        for item_dict in usable_dicts:
            try:
                # Convert dict to WardrobeItem, handling missing fields gracefully
                wardrobe_item = WardrobeItem(
                    user_id=item_dict.get('user_id', user_id),
                    id=item_dict.get('id', ''),
                    type=item_dict.get('type'),
                    name=item_dict.get('name'),
                    color=item_dict.get('color'),
                    colors=item_dict.get('colors'),
                    fabric=item_dict.get('fabric'),
                    pattern=item_dict.get('pattern'),
                    season=item_dict.get('season'),
                    seasonTags=item_dict.get('seasonTags'),
                    occasionTags=item_dict.get('occasionTags'),
                    formality=item_dict.get('formality'),
                    notes=item_dict.get('notes'),
                    imageUrl=item_dict.get('imageUrl'),
                    cleanImageUrl=item_dict.get('cleanImageUrl'),
                    category=item_dict.get('category'),
                    tags=item_dict.get('tags'),
                    styleVibe=item_dict.get('styleVibe'),
                    isFavorite=item_dict.get('isFavorite'),
                )
                wardrobe_items.append(wardrobe_item)
            except Exception as e:
                logger.warning(f"[MyraAgent] Warning: failed to convert wardrobe item to WardrobeItem: {e}")
                continue
        
        wardrobe_count = len(wardrobe_items)
        logger.info(
            f"[MyraAgent] Database={getattr(self.db, 'database_type', 'unknown')}, "
            f"user_id={user_id}, wardrobe_count={wardrobe_count}"
        )

        # If no wardrobe, keep a safe fallback
        if wardrobe_count == 0:
            why = "I couldn't find any wardrobe items for you yet. Add some clothes to your closet so I can suggest an outfit."
            return RecommendResponse(
                outfits=[{
                    "items": [],
                    "why": why,
                    "items_detail": []
                }],
                context={
                    "location": location.dict() if hasattr(location, "dict") else location,
                    "weather": weather.dict() if hasattr(weather, "dict") else weather,
                },
                used_memory=False,
            )

        temp_f = getattr(weather, "tempF", None)
        weather_dict = weather.dict() if hasattr(weather, "dict") else (weather if isinstance(weather, dict) else {})
        
        # Determine temperature band for logging
        temp_band = "unknown"
        if temp_f is not None:
            if temp_f <= 55:
                temp_band = "cold"
            elif temp_f < 75:
                temp_band = "mild"
            else:
                temp_band = "warm"
        
        # Count items by category for debug
        category_counts = {}
        for item in wardrobe_items:
            cat = self._categorize_item(item)
            category_counts[cat] = category_counts.get(cat, 0) + 1
        
        if temp_f is not None:
            logger.info(
                f"[MyraAgent] Temperature: {temp_f:.0f}°F ({temp_band}), "
                f"categories: {dict(category_counts)}"
            )
        
        # Score items with preferences and weather
        scored_items = []
        item_score_details: Dict[str, Dict[str, float]] = {}
        for item in wardrobe_items:
            try:
                score, components = self._score_item(item, preferences, temp_f, weather_dict)
            except Exception as scoring_err:
                logger.warning(f"[MyraAgent] Scoring failed for item {item.id}: {scoring_err}")
                score = 0.0
                components = {
                    "total": 0.0,
                    "occasion": 0.0,
                    "style": 0.0,
                    "favorite": 0.0,
                    "avoid_penalty": 0.0,
                    "weather": 0.0,
                }
            scored_items.append((score, item))
            item_score_details[item.id] = components
            logger.info(
                "[MyraAgent] Score for item %s: %.2f (occasion=%.2f, style=%.2f, favorite=%.2f, avoid_penalty=%.2f, weather=%.2f)",
                item.id,
                score,
                components.get("occasion", 0.0),
                components.get("style", 0.0),
                components.get("favorite", 0.0),
                components.get("avoid_penalty", 0.0),
                components.get("weather", 0.0),
            )

        # Sort by score descending
        scored_items.sort(key=lambda x: x[0], reverse=True)

        # Separate into rough categories
        tops = []
        bottoms = []
        shoes = []
        jackets = []
        others = []

        for score, item in scored_items:
            cat = self._categorize_item(item)
            if cat == "top":
                tops.append((score, item))
            elif cat == "bottom":
                bottoms.append((score, item))
            elif cat == "shoe":
                shoes.append((score, item))
            elif cat == "jacket":
                jackets.append((score, item))
            else:
                others.append((score, item))

        # Apply preference ranking per category (Phase 5A)
        # Extract items from (score, item) tuples, rank them, then reconstruct tuples
        tops_items = [item for _, item in tops]
        bottoms_items = [item for _, item in bottoms]
        shoes_items = [item for _, item in shoes]
        jackets_items = [item for _, item in jackets]
        
        # Rank items by preferences
        tops_items = self._rank_items_for_preferences(tops_items, preferences)
        bottoms_items = self._rank_items_for_preferences(bottoms_items, preferences)
        shoes_items = self._rank_items_for_preferences(shoes_items, preferences)
        jackets_items = self._rank_items_for_preferences(jackets_items, preferences)
        
        # Reconstruct tuples with original scores (for compatibility with existing selection logic)
        # We'll use the preference-ranked order but keep scores for logging
        tops_ranked = []
        bottoms_ranked = []
        shoes_ranked = []
        jackets_ranked = []
        
        # Create a lookup for scores by item id
        score_lookup = {item.id: score for score, item in scored_items}
        
        for item in tops_items:
            tops_ranked.append((score_lookup.get(item.id, 0.0), item))
        for item in bottoms_items:
            bottoms_ranked.append((score_lookup.get(item.id, 0.0), item))
        for item in shoes_items:
            shoes_ranked.append((score_lookup.get(item.id, 0.0), item))
        for item in jackets_items:
            jackets_ranked.append((score_lookup.get(item.id, 0.0), item))
        
        # Update category lists with ranked versions
        tops = tops_ranked
        bottoms = bottoms_ranked
        shoes = shoes_ranked
        jackets = jackets_ranked

        # Phase 5C: Generate candidate outfits and score them with preferences
        candidate_outfits: List[Tuple[List[WardrobeItem], float, bool]] = []
        item_scores_final: Dict[str, Dict[str, float]] = {}
        
        # Generate candidate outfits (top + bottom + shoe + optional jacket)
        # Consider top 3 items from each category to create multiple candidates
        top_candidates = [item for _, item in tops[:3]] if tops else []
        bottom_candidates = [item for _, item in bottoms[:3]] if bottoms else []
        shoe_candidates = [item for _, item in shoes[:3]] if shoes else []
        jacket_candidates = [item for _, item in jackets[:3]] if jackets else []
        
        # Generate combinations (limit to reasonable number)
        for top_item in top_candidates[:2]:  # Limit to top 2 to avoid too many combinations
            for bottom_item in bottom_candidates[:2]:
                for shoe_item in shoe_candidates[:2]:
                    outfit_items = [top_item, bottom_item, shoe_item]
                    
                    # Add jacket if cold weather
                    if temp_f is not None and temp_f <= 55 and jacket_candidates:
                        for jacket_item in jacket_candidates[:1]:  # Just top jacket
                            candidate = outfit_items + [jacket_item]
                            candidate_outfits.append((candidate, 0.0, False))
                    else:
                        candidate_outfits.append((outfit_items, 0.0, False))
        
        # Fallback: if no candidates generated, use simple selection
        item_scores_final: Dict[str, Dict[str, float]] = {}
        if not candidate_outfits:
            chosen_items: List[WardrobeItem] = []
            if tops:
                chosen_items.append(tops[0][1])
            if bottoms:
                chosen_items.append(bottoms[0][1])
            if shoes:
                chosen_items.append(shoes[0][1])
            if temp_f is not None and temp_f <= 55 and jackets:
                chosen_items.append(jackets[0][1])
            if not chosen_items:
                chosen_items = [item for _, item in scored_items[:3]]
            
            for item in chosen_items:
                if item.id in item_score_details:
                    item_scores_final[item.id] = item_score_details[item.id]
                else:
                    _, comp = self._score_item(item, preferences, temp_f, weather_dict)
                    item_scores_final[item.id] = comp
        else:
            # Score each candidate outfit
            scored_candidates = []
            for outfit_items, _, _ in candidate_outfits:
                base_outfit_score = 0.0
                has_avoided_colors = False
                combined_components: Dict[str, Dict[str, float]] = {}
                
                for item in outfit_items:
                    components = item_score_details.get(item.id)
                    if not components:
                        _, components = self._score_item(item, preferences, temp_f, weather_dict)
                    combined_components[item.id] = components
                    base_outfit_score += components.get("total", 0.0)
                    if components.get("avoid_penalty", 0.0) < 0:
                        has_avoided_colors = True
                
                scored_candidates.append((
                    outfit_items,
                    base_outfit_score,
                    has_avoided_colors,
                    combined_components,
                    base_outfit_score,
                ))
            
            # Sort candidates: prefer outfits without avoided colors, then by score
            scored_candidates.sort(key=lambda x: (x[2], -x[1]))  # has_avoided_colors (False first), then -score (higher first)
            
            # Select best outfit
            best_outfit = scored_candidates[0]
            chosen_items = best_outfit[0]
            item_scores_final = best_outfit[3]
        
        selected_with_scores = []
        for item in chosen_items:
            comp = item_scores_final.get(item.id) or item_score_details.get(item.id) or {}
            selected_with_scores.append(f"{item.id}:{comp.get('total', 0.0):.2f}")
        logger.info("[MyraAgent] Selected outfit items with scores: %s", ", ".join(selected_with_scores))
        
        # Enhanced logging for preference scores - detailed breakdown (Phase 5C)
        if preferences:
            # Log preference summary
            logger.info(
                "[MyraAgent] Preferences: occasion=%s, style_vibe=%s, prefer_favorites=%s, avoid_colors=%s",
                preferences.get('occasion'),
                preferences.get('style_vibe'),
                preferences.get('prefer_favorites'),
                preferences.get('avoid_colors'),
            )
            
            # Ensure we have scores for all selected items
            final_item_scores = item_scores_final.copy()
            for item in chosen_items:
                if item.id not in final_item_scores:
                    _, comp = self._score_item(item, preferences, temp_f, weather_dict)
                    final_item_scores[item.id] = comp
            
            # Log detailed per-item scores - one log line per item for clarity
            for item in chosen_items:
                item_id = item.id
                scores = final_item_scores.get(item_id, {})
                logger.info(
                    "[MyraAgent] Preference score for item %s: total=%.2f, occasion=%.2f, style=%.2f, favorite=%.2f, avoid_penalty=%.2f, weather=%.2f",
                    item_id,
                    float(scores.get("total", 0.0)),
                    float(scores.get("occasion", 0.0)),
                    float(scores.get("style", 0.0)),
                    float(scores.get("favorite", 0.0)),
                    float(scores.get("avoid_penalty", 0.0)),
                    float(scores.get("weather", 0.0)),
                )

        # Build items_detail payload
        items_detail = []
        favorite_count = 0
        for item in chosen_items:
            if item.isFavorite:
                favorite_count += 1
            # Prefer cleanImageUrl if available
            img = item.cleanImageUrl or item.imageUrl
            items_detail.append({
                "id": item.id,
                "imageUrl": img,
                "category": item.category,
                "color": item.color or (item.colors[0] if item.colors else None),
                "tags": item.tags or [],
                "seasonTags": item.seasonTags or [],
                "occasionTags": item.occasionTags or [],
                "isFavorite": bool(item.isFavorite),
            })

        # Build explanation with detailed item descriptions
        item_descriptions = []
        for item in chosen_items:
            desc = self._describe_item(item)
            item_descriptions.append(desc)
        
        # Build piece descriptions
        pieces_str = ""
        if len(item_descriptions) > 0:
            if len(item_descriptions) == 1:
                pieces_str = item_descriptions[0]
            elif len(item_descriptions) == 2:
                pieces_str = f"{item_descriptions[0]} and {item_descriptions[1]}"
            else:
                # Join all but last with commas, last with "and"
                pieces_str = ", ".join(item_descriptions[:-1]) + f", and {item_descriptions[-1]}"
        
        # Build weather/location context
        loc_name = getattr(location, "name", None) if location else None
        temp_str = f"{temp_f:.0f}°F" if temp_f is not None else None
        
        # Determine temperature description
        temp_desc = ""
        if temp_f is not None:
            if temp_f <= 55:
                temp_desc = "chilly"
            elif temp_f < 75:
                temp_desc = "mild"
            elif temp_f >= 75:
                temp_desc = "warm"
        
        # Build the explanation
        why_parts = []
        
        # Start with context (temp/location)
        if temp_str and loc_name:
            why_parts.append(f"For {temp_str} in {loc_name}")
        elif temp_str:
            if temp_desc:
                why_parts.append(f"Since it's {temp_desc} today (~{temp_str})")
            else:
                why_parts.append(f"For {temp_str}")
        elif loc_name:
            why_parts.append(f"In {loc_name}")
        # If no temp or location, we'll just start with "I picked..."
        
        # Add item selection
        if pieces_str:
            why_parts.append(f"I picked {pieces_str}")
        else:
            why_parts.append("I picked a simple outfit")
        
        # Add style note based on temperature
        if temp_f is not None:
            if temp_f <= 55:
                why_parts.append("prioritizing warmer layers")
            elif temp_f >= 75:
                why_parts.append("for a breathable, comfortable look")
            else:
                why_parts.append("for a balanced, comfortable look")
        
        # Add favorite note
        if favorite_count > 0:
            fav_note = f"included {favorite_count} of your favorite{'s' if favorite_count > 1 else ''}"
            why_parts.append(f"and {fav_note}")
        
        why = ". ".join(why_parts) + "."
        
        # Clean up any double spaces or awkward punctuation
        why = why.replace("  ", " ").replace("..", ".").strip()

        return RecommendResponse(
            outfits=[{
                "items": [item.id for item in chosen_items],
                "why": why,
                "items_detail": items_detail,
            }],
            context={
                "location": location.dict() if hasattr(location, "dict") else location,
                "weather": weather.dict() if hasattr(weather, "dict") else weather,
            },
            used_memory=False,
        )

# Phase 6B scoring summary:
# - Occasion/style matches add up to +3 points each for exact matches (+2 for partials).
# - Favorite items gain +4 points when the user prefers favorites.
# - Avoided colors apply a -100 penalty but remain available as a fallback.
# - Weather adjustments provide +/-2 point nudges for heat/cold/rain scenarios.
# - Candidate outfits prefer combinations without avoided colors; penalties apply only if no clean outfit exists.
