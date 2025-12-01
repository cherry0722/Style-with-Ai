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

    def _score_item(self, item: WardrobeItem, temp_f: Optional[float], weather: Optional[Dict[str, Any]] = None) -> float:
        """
        Weather-aware scoring function based on temperature, item type, season tags, and favorites.
        Higher score = more suitable.
        """
        score = 1.0  # Base score

        # Extract fields safely
        season_tags = [t.lower() for t in (item.seasonTags or [])]
        is_fav = bool(item.isFavorite)
        category = self._categorize_item(item)
        item_type = (item.type or "").lower()
        color_type = (item.color_type or "").lower() if item.color_type else ""
        style_tags = [t.lower() for t in (item.style_tags or [])] if item.style_tags else []
        
        # Temperature-based scoring
        if temp_f is not None:
            # Define temperature bands
            is_cold = temp_f <= 55
            is_mild = 55 < temp_f < 75
            is_warm = temp_f >= 75

            # Tops scoring
            if category == "top":
                # Heavy/warm tops
                if any(t in item_type for t in ["hoodie", "sweater", "jacket", "cardigan"]):
                    if is_cold:
                        score += 2.0
                    elif is_mild:
                        score += 0.5
                    else:  # warm
                        score -= 1.0
                
                # Light/breathable tops
                elif any(t in item_type for t in ["t-shirt", "shirt", "polo", "tank", "camisole"]):
                    if is_warm:
                        score += 1.5
                    elif is_mild:
                        score += 0.5
                    else:  # cold
                        score -= 1.0
                
                # Default top bonus for mild/warm
                elif is_mild or is_warm:
                    score += 0.5

            # Bottoms scoring
            elif category == "bottom":
                # Shorts
                if "shorts" in item_type:
                    if is_warm:
                        score += 1.5
                    elif is_mild:
                        score += 0.3
                    else:  # cold
                        score -= 1.5
                
                # Full-length bottoms
                elif any(t in item_type for t in ["jeans", "trousers", "pants"]):
                    if is_cold or is_mild:
                        score += 0.5
                    # Warm: neutral (jeans can work but not ideal)

            # Shoes scoring
            elif category == "shoe":
                # Sneakers - versatile for all weather
                if "sneaker" in item_type or "sneakers" in item_type:
                    score += 0.5  # Neutral to slightly positive
                
                # Boots - better for cold
                elif "boot" in item_type:
                    if is_cold:
                        score += 1.0
                    elif is_warm:
                        score -= 0.5
                
                # Sandals/slides - better for warm
                elif any(t in item_type for t in ["sandal", "slide"]):
                    if is_warm:
                        score += 1.0
                    elif is_cold:
                        score -= 1.0

            # Jacket/outerwear scoring
            elif category == "jacket":
                if is_cold:
                    score += 3.0
                elif is_mild:
                    score += 1.0
                else:  # warm
                    score -= 1.5  # Avoid heavy jackets in heat

            # Season tags matching
            if season_tags:
                if is_cold:
                    if "winter" in season_tags or "cold" in season_tags:
                        score += 1.5
                    elif "summer" in season_tags or "hot" in season_tags:
                        score -= 1.0  # Mismatch penalty
                
                elif is_mild:
                    if "spring" in season_tags or "fall" in season_tags or "autumn" in season_tags:
                        score += 1.0
                
                elif is_warm:
                    if "summer" in season_tags or "hot" in season_tags:
                        score += 1.5
                    elif "winter" in season_tags or "cold" in season_tags:
                        score -= 1.0  # Mismatch penalty

        # Favorites boost
        if is_fav:
            score += 1.0

        # Lightweight color/style hints (don't dominate)
        if color_type:
            # Neutral colors work well in all situations (tiny boost)
            if color_type in ["neutral"]:
                score += 0.2
        
        if style_tags:
            # Casual style is a good default (tiny boost)
            if "casual" in style_tags:
                score += 0.2

        return score

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
            print(
                f"[MyraAgent] Temperature: {temp_f:.0f}°F ({temp_band}), "
                f"categories: {dict(category_counts)}"
            )
        
        # Score items
        scored_items = []
        for item in wardrobe_items:
            score = self._score_item(item, temp_f, weather_dict)
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
