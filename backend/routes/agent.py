# routes/agent.py
from fastapi import APIRouter
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
    return _agent.recommend(req)
