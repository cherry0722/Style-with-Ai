# ai/agent.py
from typing import Dict, Any, Optional, List
import os

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
        Uses item.category and tags as hints.
        """
        cat = (item.category or "").lower()
        tags = [t.lower() for t in (item.tags or [])]

        # Tops
        top_keywords = ["top", "tshirt", "t-shirt", "shirt", "blouse", "hoodie", "sweater"]
        if any(k in cat for k in top_keywords) or any(k in tags for k in top_keywords):
            return "top"

        # Bottoms
        bottom_keywords = ["jeans", "pants", "trousers", "skirt", "shorts", "bottom"]
        if any(k in cat for k in bottom_keywords) or any(k in tags for k in bottom_keywords):
            return "bottom"

        # Shoes
        shoe_keywords = ["shoe", "sneaker", "boot", "heel", "sandal"]
        if any(k in cat for k in shoe_keywords) or any(k in tags for k in shoe_keywords):
            return "shoe"

        # Jackets / outerwear
        jacket_keywords = ["jacket", "coat", "blazer", "overcoat"]
        if any(k in cat for k in jacket_keywords) or any(k in tags for k in jacket_keywords):
            return "jacket"

        return "other"

    def _score_item(self, item: WardrobeItem, temp_f: Optional[float]) -> float:
        """
        Simple scoring function based on temperature, season tags, and favorites.
        Higher score = more suitable.
        """
        score = 1.0

        season_tags = [t.lower() for t in (item.seasonTags or [])]
        is_fav = bool(item.isFavorite)
        category = self._categorize_item(item)

        # Temperature-based preferences
        if temp_f is not None:
            if temp_f <= 50:
                # Cold: jackets and heavier pieces
                if category == "jacket":
                    score += 3.0
                if "winter" in season_tags or "cold" in season_tags:
                    score += 2.0
            elif 50 < temp_f < 75:
                # Mild: layers
                if category in ("top", "bottom"):
                    score += 1.5
                if "spring" in season_tags or "fall" in season_tags:
                    score += 1.0
            else:
                # Warm: breathable
                if category in ("top", "bottom"):
                    score += 2.0
                if "summer" in season_tags or "hot" in season_tags:
                    score += 1.5
                if category == "jacket":
                    score -= 1.0  # avoid heavy jackets in heat

        # Favorites get a small boost
        if is_fav:
            score += 1.0

        return score

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

        # Fetch wardrobe from DB (returns dicts, convert to WardrobeItem)
        wardrobe_dicts = self.db.get_user_wardrobe(user_id)
        wardrobe_items: List[WardrobeItem] = []
        for item_dict in wardrobe_dicts:
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
                print(f"[MyraAgent] Warning: failed to convert wardrobe item to WardrobeItem: {e}")
                continue
        
        wardrobe_count = len(wardrobe_items)
        print(
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
        # Score items
        scored_items = []
        for item in wardrobe_items:
            score = self._score_item(item, temp_f)
            scored_items.append((score, item))

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

        chosen_items: List[WardrobeItem] = []

        # Try to build a basic outfit: top + bottom + optional shoe + optional jacket
        if tops:
            chosen_items.append(tops[0][1])
        if bottoms:
            chosen_items.append(bottoms[0][1])
        if shoes:
            chosen_items.append(shoes[0][1])

        # Optional jacket in colder weather
        if temp_f is not None and temp_f <= 55 and jackets:
            chosen_items.append(jackets[0][1])

        # Fallback: if we still have nothing, just take the top N scored items
        if not chosen_items:
            chosen_items = [item for _, item in scored_items[:3]]

        print(f"[MyraAgent] Selected outfit items: {[item.id for item in chosen_items]}")

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

        # Build explanation
        temp_str = f"{temp_f:.0f}°F" if temp_f is not None else "today's weather"
        loc_name = getattr(location, "name", None) if location else None
        loc_part = f"in {loc_name}" if loc_name else ""
        fav_part = ""
        if favorite_count > 0:
            fav_part = f" and included {favorite_count} of your favorites"

        why = (
            f"For {temp_str} {loc_part}, I picked a simple outfit that balances comfort and style"
            f"{fav_part} based on what you have in your wardrobe."
        ).strip()

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
