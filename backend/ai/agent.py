# ai/agent.py
from typing import Dict, Any, Optional

from db.mongo import get_user_profile, get_user_wardrobe
from ai.preference import PreferenceScorer
from ai.rag_engine import suggest_with_rag
from schemas.models import RecommendRequest, RecommendResponse


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
        rag_result = suggest_with_rag(
            user_id=user_id,
            event_text=event_text,
            weather=weather,
            wardrobe_items=ranked,
        )

        return RecommendResponse(
            outfits=[o for o in rag_result.get("outfits", [])],
            context={"event": event_text, "weather": weather},
            used_memory=bool(profile),
        )
