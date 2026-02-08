# schemas/models.py
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


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


# --- Process-item (Phase 2B) ---


class ProcessItemRequest(BaseModel):
    userId: str
    rawKey: str
    rawUrl: str


# LOCKED v1 ItemProfile schema (strict JSON from Vision)
VALID_CATEGORIES = {"top", "bottom", "shoes", "outerwear", "accessory", "dress", "traditional_set"}
VALID_SEASONS = {"spring", "summer", "fall", "winter", "all"}


class ItemProfile(BaseModel):
    """Structured output from OpenAI Vision. LOCKED v1 schema."""
    type: Optional[str] = None
    category: Optional[str] = None
    primaryColor: Optional[str] = None
    secondaryColor: Optional[str] = None
    colorUndertone: Optional[str] = None
    pattern: Optional[str] = None
    material: Optional[str] = None
    fit: Optional[str] = None
    formality: Optional[int] = Field(None, ge=0, le=10)
    season: Optional[str] = None
    styleTags: Optional[List[str]] = Field(default_factory=list)
    keyDetails: Optional[List[str]] = Field(default_factory=list)
    pairingHints: Optional[List[str]] = Field(default_factory=list)
    confidence: Optional[int] = Field(None, ge=0, le=100)

    @field_validator("formality", mode="before")
    @classmethod
    def coerce_formality(cls, v: Any) -> Optional[int]:
        if v is None:
            return None
        try:
            n = int(float(str(v).strip()))
            return max(0, min(10, n))
        except (ValueError, TypeError):
            return None

    @field_validator("confidence", mode="before")
    @classmethod
    def coerce_confidence(cls, v: Any) -> Optional[int]:
        if v is None:
            return None
        try:
            n = int(float(str(v).strip()))
            return max(0, min(100, n))
        except (ValueError, TypeError):
            return None

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v: Any) -> Optional[str]:
        if v is None or not isinstance(v, str):
            return None
        s = v.strip().lower()
        if s in VALID_CATEGORIES:
            return s
        m = {"tops": "top", "bottoms": "bottom", "accessories": "accessory"}
        return m.get(s, "top")

    @field_validator("season", mode="before")
    @classmethod
    def normalize_season(cls, v: Any) -> Optional[str]:
        if v is None or not isinstance(v, str):
            return None
        s = v.strip().lower()
        if s in VALID_SEASONS:
            return s
        if "all" in s or "season" in s:
            return "all"
        for seas in ("spring", "summer", "fall", "winter"):
            if seas in s:
                return seas
        return "all"

    @field_validator("styleTags", "keyDetails", "pairingHints", mode="before")
    @classmethod
    def coerce_list(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return [str(x).strip() for x in v if x is not None and str(x).strip()]
        return []

    def to_node_profile(self) -> Dict[str, Any]:
        """Convert to Node Wardrobe-compatible profile dict."""
        d = {}
        if self.type:
            d["type"] = self.type
        if self.category:
            d["category"] = self.category
        colors = []
        if self.primaryColor:
            colors.append(self.primaryColor)
        if self.secondaryColor:
            colors.append(self.secondaryColor)
        if colors:
            d["colors"] = colors
            d["color_name"] = self.primaryColor
        if self.colorUndertone:
            d["color_type"] = self.colorUndertone
        if self.pattern:
            d["pattern"] = self.pattern
        if self.material:
            d["fabric"] = self.material
        if self.fit:
            d["fit"] = self.fit
        if self.formality is not None:
            d["formality"] = str(self.formality)  # Node may expect string
        if self.season:
            d["seasonTags"] = [self.season]
        if self.styleTags:
            d["style_tags"] = self.styleTags
            d["styleVibe"] = self.styleTags
        d["occasionTags"] = d.get("occasionTags", [])
        return d


class ProcessItemResponse(BaseModel):
    status: str  # "ready" | "failed"
    cleanKey: Optional[str] = None
    cleanUrl: Optional[str] = None
    profile: Optional[Dict[str, Any]] = None
    failReason: Optional[str] = None


# --- Generate-outfits (Phase 3C): text-only outfit generation ---


class GenerateOutfitsLocation(BaseModel):
    """Optional location for outfit context. No geocoding."""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None


class GenerateOutfitsWeather(BaseModel):
    """Optional weather for outfit context."""
    tempF: Optional[float] = None
    condition: Optional[str] = None


class GenerateOutfitsItem(BaseModel):
    """Single item payload: id + profile (LOCKED ItemProfile schema)."""
    id: str
    profile: Optional[Dict[str, Any]] = None  # ItemProfile from Vision


class GenerateOutfitsRequest(BaseModel):
    """Request for text-only outfit generation. No images."""
    occasion: Optional[str] = None
    location: Optional[GenerateOutfitsLocation] = None
    weather: Optional[GenerateOutfitsWeather] = None
    items: List[GenerateOutfitsItem] = Field(default_factory=list)


class GenerateOutfitsOutfit(BaseModel):
    """One outfit in the response."""
    itemIds: List[str] = Field(default_factory=list)
    why: str = ""
    notes: List[str] = Field(default_factory=list)


class GenerateOutfitsResponse(BaseModel):
    """Response: exactly 3 outfits when possible, each with why + notes."""
    outfits: List[GenerateOutfitsOutfit] = Field(default_factory=list)
