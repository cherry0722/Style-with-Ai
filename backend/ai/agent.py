# ai/agent.py
from typing import Dict, Any, Optional
import os

from db.mongo import get_user_profile, get_user_wardrobe, get_items_by_ids
from calendar_helper import get_events_for_today
from ai.preference import PreferenceScorer
from ai.rag_engine import suggest_with_rag
from schemas.models import RecommendRequest, RecommendResponse

# LLM opt-in toggle
USE_LLM = os.getenv('ENABLE_LLM', 'false').lower() == 'true'
try:
    from .graph.graph import run_graph
except Exception:
    run_graph = None


class MyraAgent:
    """
    Orchestrator for MYRA:
      - Loads wardrobe and user profile
      - Applies preference-aware reranking
      - Calls RAG+LLM to get outfits
    """

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

    def suggest_outfit(self, req) -> RecommendResponse:
        """
        Lightweight rule-based outfit suggester used as an MVP.
        Expects req with attributes: user_id, location, weather
        """
        user_id = getattr(req, 'user_id', None) or req.get('user_id')
        location = getattr(req, 'location', None) or req.get('location')
        weather = getattr(req, 'weather', None) or req.get('weather')

        # Load wardrobe and profile
        wardrobe = get_user_wardrobe(user_id) or []
        profile = get_user_profile(user_id) or {}

        # If LLM is enabled and graph is available, use it (non-breaking)
        if USE_LLM and run_graph is not None:
            try:
                graph_out = run_graph(user_id, location, weather)
                return RecommendResponse(outfits=[o for o in graph_out.get('outfits', [])], context=graph_out.get('context', {}), used_memory=bool(profile))
            except Exception as e:
                print(f"[Agent] LLM graph failed, falling back to rule-based: {e}")

        # Optional calendar events (calendar integration is optional)
        events = []
        try:
            events = get_events_for_today(user_id)
        except Exception:
            events = []

        # Simple rule-based logic:
        # - If tempF < 50 -> recommend layers (jacket + top + bottoms)
        # - If tempF between 50 and 75 -> recommend light layers (top + bottoms)
        # - If tempF > 75 -> recommend breathable items (shorts / light dress)
        temp = None
        try:
            temp = weather.get('tempF') if isinstance(weather, dict) else getattr(weather, 'tempF', None)
        except Exception:
            temp = None

        def choose_by_category(cat):
            for item in wardrobe:
                if item.get('type') == cat or item.get('category') == cat:
                    return item
            return None

        outfits = []
        # If events found, map keywords to outfit templates
        event_keywords = []
        for e in events:
            title = e.get('title', '') or ''
            event_keywords += title.lower().split()

        def event_priority():
            # Check for common keywords
            if any(k in event_keywords for k in ['gym', 'workout']):
                return 'casual_active'
            if any(k in event_keywords for k in ['meeting', 'interview', 'client']):
                return 'formal'
            if any(k in event_keywords for k in ['dinner', 'party', 'date']):
                return 'smart_casual'
            return None

        priority = event_priority()

        # Basic templates
        if temp is None:
            # fallback: pick any 3 items
            chosen = [i for i in wardrobe][:3]
            outfits.append({"items": [c.get('id') for c in chosen], "why": "Fallback selection"})
        else:
            if temp < 50:
                pieces = []
                # For formal events prefer a blazer if available
                if priority == 'formal':
                    cats = ['blazer', 'jacket', 'top', 'bottom']
                else:
                    cats = ['jacket', 'top', 'bottom']
                for cat in cats:
                    it = choose_by_category(cat)
                    if it:
                        pieces.append(it.get('id'))
                outfits.append({"items": pieces, "why": f"Cold weather ({temp}F): layers recommended"})
            elif temp < 75:
                pieces = []
                # For active events prefer comfortable shoes
                if priority == 'casual_active':
                    cats = ['top', 'bottom', 'sneakers']
                elif priority == 'formal':
                    cats = ['top', 'bottom', 'shoe']
                else:
                    cats = ['top', 'bottom', 'shoe']
                for cat in cats:
                    it = choose_by_category(cat)
                    if it:
                        pieces.append(it.get('id'))
                outfits.append({"items": pieces, "why": f"Mild weather ({temp}F): light layers"})
            else:
                pieces = []
                # Warm weather: if smart_casual event, prefer light dress/top
                if priority == 'smart_casual':
                    cats = ['dress', 'top', 'bottom']
                else:
                    cats = ['dress', 'shorts', 'top']
                for cat in cats:
                    it = choose_by_category(cat)
                    if it:
                        pieces.append(it.get('id'))
                outfits.append({"items": pieces, "why": f"Warm weather ({temp}F): breathable pieces"})

        # Enrich item IDs with light metadata for frontend convenience
        enriched_outfits = []
        for o in outfits:
            ids = o.get('items', [])
            items_detail = []
            try:
                # fetch minimal item metadata from DB: id, name, category, color, image_url
                db_items = get_items_by_ids(user_id, ids) if ids else []
                for di in db_items:
                    items_detail.append({
                        'id': di.get('id'),
                        'name': di.get('name') or di.get('type') or di.get('category'),
                        'category': di.get('category') or di.get('type'),
                        'color': di.get('color'),
                        'image_url': di.get('uri') or di.get('image_url'),
                    })
            except Exception as e:
                # If enrichment fails, continue returning IDs only
                print(f"[Agent] Warning: failed to enrich items: {e}")

            enriched_outfits.append({
                'items': o['items'],
                'items_detail': items_detail,
                'why': o['why']
            })

        # Log enrichment summary
        total_enriched = sum(len(o.get('items_detail', [])) for o in enriched_outfits)
        print(f"[Agent] Enriched outfit items count: {total_enriched}")

        return RecommendResponse(outfits=enriched_outfits, context={"location": location, "weather": weather}, used_memory=bool(profile))
