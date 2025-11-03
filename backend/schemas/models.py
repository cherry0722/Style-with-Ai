# schemas/models.py
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class WardrobeItem(BaseModel):
    user_id: str
    id: str
    type: str
    name: str
    color: str
    fabric: str
    pattern: Optional[str] = None
    season: Optional[List[str]] = None
    formality: Optional[str] = None
    notes: Optional[str] = None
    embedding: Optional[List[float]] = None  # 768-d e5 vector (optional for now)


class Weather(BaseModel):
    summary: Optional[str] = None
    tempF: Optional[float] = None
    precipChance: Optional[float] = None


class RecommendRequest(BaseModel):
    user_id: str = Field(..., description="User ID from your auth system/app")
    event: Optional[str] = Field(None, description="Event description, e.g. 'Dinner at 7pm'")
    weather: Optional[Weather] = None


class Outfit(BaseModel):
    items: List[str]
    why: str


class RecommendResponse(BaseModel):
    outfits: List[Outfit]
    context: Dict[str, Any]
    used_memory: bool = False


class FeedbackIn(BaseModel):
    user_id: str
    outfit_items: List[str]
    label: str  # "like" or "dislike"
