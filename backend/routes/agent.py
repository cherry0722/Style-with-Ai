# routes/agent.py
import os
from fastapi import APIRouter, HTTPException
from schemas.models import RecommendRequest, RecommendResponse, SuggestRequest
from ai.agent import MyraAgent

router = APIRouter()
_agent = MyraAgent()


@router.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    """
    Main endpoint for MYRA outfit recommendations.
    Frontend sends: { user_id, event, weather }
    """
    # Gate AI features behind environment flag
    if os.getenv("AI_ENABLE", "false").lower() != "true":
        raise HTTPException(
            status_code=501,
            detail="AI features disabled. Set AI_ENABLE=true to enable."
        )
    
    return _agent.recommend(req)


@router.post("/suggest_outfit", response_model=RecommendResponse)
def suggest_outfit(req: SuggestRequest):
    """
    Lightweight suggest endpoint for the MVP. Requires: user_id, location, weather
    """
    # Gate AI features behind environment flag
    if os.getenv("AI_ENABLE", "false").lower() != "true":
        raise HTTPException(
            status_code=501,
            detail="AI features disabled. Set AI_ENABLE=true to enable."
        )

    try:
        return _agent.suggest_outfit(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
