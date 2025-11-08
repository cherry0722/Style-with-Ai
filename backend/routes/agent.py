# routes/agent.py
import os
from fastapi import APIRouter, HTTPException
from schemas.models import RecommendRequest, RecommendResponse
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
