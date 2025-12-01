# schemas/models.py
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class WardrobeItem(BaseModel):
    user_id: str
    id: str
    type: Optional[str] = None
    name: Optional[str] = None
    color: Optional[str] = None
    colors: Optional[List[str]] = None
    fabric: Optional[str] = None
    pattern: Optional[str] = None
    season: Optional[List[str]] = None
    seasonTags: Optional[List[str]] = None
    occasionTags: Optional[List[str]] = None
    formality: Optional[str] = None
    notes: Optional[str] = None
    embedding: Optional[List[float]] = None  # 768-d e5 vector (optional for now)
    
    # Image fields
    imageUrl: Optional[str] = None
    cleanImageUrl: Optional[str] = None
    
    # Category and metadata
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    styleVibe: Optional[List[str]] = None
    isFavorite: Optional[bool] = None
    
    # Additional metadata fields from Mongoose schema
    color_name: Optional[str] = None
    color_type: Optional[str] = None
    fit: Optional[str] = None
    style_tags: Optional[List[str]] = None


class Weather(BaseModel):
    summary: Optional[str] = None
    tempF: Optional[float] = None
    precipChance: Optional[float] = None


class Location(BaseModel):
    latitude: float
    longitude: float
    name: Optional[str] = None


class RecommendRequest(BaseModel):
    user_id: str = Field(..., description="User ID from your auth system/app")
    event: Optional[str] = Field(None, description="Event description, e.g. 'Dinner at 7pm'")
    weather: Optional[Weather] = None


class Preferences(BaseModel):
    occasion: Optional[str] = Field(None, description="Occasion type, e.g. 'date-night', 'casual', 'formal', 'office'")
    style_vibe: Optional[str] = Field(None, description="Style vibe, e.g. 'smart-casual', 'streetwear', 'minimal'")
    prefer_favorites: Optional[bool] = Field(None, description="Whether to prefer favorite items")
    avoid_colors: Optional[List[str]] = Field(None, description="List of colors to avoid")


class SuggestRequest(BaseModel):
    user_id: str = Field(..., description="User ID from your auth system/app")
    location: Location = Field(..., description="Location (lat/lon) used to fetch weather if needed")
    weather: Weather = Field(..., description="Current weather summary and numeric fields")
    preferences: Optional[Preferences] = Field(None, description="Optional user preferences for outfit selection")


class Outfit(BaseModel):
    items: List[str]
    why: str
    # Non-breaking enrichment: optional detailed metadata for items
    items_detail: Optional[List[Dict[str, Any]]] = None


class RecommendResponse(BaseModel):
    outfits: List[Outfit]
    context: Dict[str, Any]
    used_memory: bool = False


class FeedbackIn(BaseModel):
    user_id: str
    outfit_items: List[str]
    label: str  # "like" or "dislike"
