# app.py
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

# Load environment variables from .env
ROOT_ENV = Path(__file__).resolve().parents[1] / ".env"
if ROOT_ENV.exists():
    load_dotenv(dotenv_path=ROOT_ENV)
else:
    load_dotenv()

from schemas.models import (
    SuggestRequest,
    RecommendResponse,
    ProcessItemRequest,
    ProcessItemResponse,
    RemoveBgRequest,
    RemoveBgResponse,
    GenerateOutfitsRequest,
    GenerateOutfitsResponse,
    GenerateOutfitsOutfit,
    AvatarMappingRequest,
    AvatarMappingResult,
    AvatarPalette,
    AvatarRenderHints,
)
from ai.agent import MyraAgent
from db.mongo import get_db
from services.process_item import process_item, remove_bg_only, VisionFailedError
from services.generate_outfits import generate_outfits
from services.avatar_mapping import map_item_to_avatar, map_item_profile_to_avatar

app = FastAPI(title="MYRA AI Backend", version="0.1.0")

# CORS configuration - allow all origins for ngrok/dev use
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agent
_agent = MyraAgent()


@app.get("/")
def root():
    return {"message": "MYRA AI backend is running"}


@app.get("/health")
async def health():
    """Health check endpoint. Returns { ok: true } for Node warmup and health checks."""
    db = get_db()
    
    # Check database type
    if hasattr(db, 'database_type'):
        db_type = db.database_type
        if db_type == "mongo":
            try:
                db.client.admin.command('ping')
                return {"ok": True, "status": "healthy", "database": "mongo"}
            except Exception as e:
                raise HTTPException(status_code=503, detail=f"DB down: {e}")
    
    # Default to mock
    return {"ok": True, "status": "healthy", "database": "mock"}


@app.post("/suggest_outfit", response_model=RecommendResponse)
def suggest_outfit(req: SuggestRequest):
    """
    Lightweight suggest endpoint for outfit recommendations.
    Requires: user_id, location, weather
    """
    try:
        return _agent.suggest_outfit(req)
    except Exception as e:
        print(f"[API] Error in suggest_outfit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Process-item (Phase 2B) ---
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN")


def _require_internal_token(x_internal_token: str | None = Header(None, alias="X-Internal-Token")):
    """If INTERNAL_TOKEN is set, require X-Internal-Token header."""
    if INTERNAL_TOKEN and x_internal_token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Token")


# --- Phase 3C: Text-only outfit generation (no images) ---
@app.post("/generate-outfits", response_model=GenerateOutfitsResponse)
def generate_outfits_endpoint(req: GenerateOutfitsRequest):
    """
    Generate up to 3 outfits from wardrobe items (id + profile only).
    No images, no Vision. Uses OpenAI TEXT when key present; else deterministic fallback.
    """
    items = [{"id": it.id, "profile": it.profile} for it in req.items]
    location = req.location.model_dump() if req.location else None
    weather = req.weather.model_dump() if req.weather else None
    outfits = generate_outfits(
        items=items,
        occasion=req.occasion,
        location=location,
        weather=weather,
    )
    return GenerateOutfitsResponse(
        outfits=[GenerateOutfitsOutfit(**o) for o in outfits],
    )


@app.post("/avatar-mapping", response_model=AvatarMappingResult)
def avatar_mapping_endpoint(req: AvatarMappingRequest):
    """
    V1 Avatar Fabric/Material Mapping.

    Accepts wardrobe item attributes (category, type, colors, pattern, material,
    fit, keyDetails) and returns a structured avatar asset-mapping result.

    Supports top and bottom garments only in V1.
    Accepts either individual fields OR a full ItemProfile dict via `profile`.
    Individual fields take precedence over profile values when both are provided.
    """
    # Merge profile dict with top-level fields (individual fields win)
    base: dict = {}
    if req.profile:
        base = dict(req.profile)

    category   = req.category   or base.get("category")
    type_      = req.type       or base.get("type")
    # Primary color: check all known field names in priority order.
    # Bug that caused palette.primary=null: endpoint only checked req.primaryColor
    # and base["primaryColor"], but curl callers and the Node wardrobe model send
    # the field as "color" or "color_name" — both silently dropped by Pydantic.
    # Resolution order: primaryColor (Vision) > color (Node flat) >
    #                   profile.primaryColor > profile.color > profile.color_name
    primary    = (req.primaryColor
                  or req.color
                  or base.get("primaryColor")
                  or base.get("color")
                  or base.get("color_name"))
    secondary  = req.secondaryColor or base.get("secondaryColor")
    pattern    = req.pattern    or base.get("pattern")
    material   = req.material   or base.get("material") or base.get("fabric")
    fit        = req.fit        or base.get("fit")
    key_details = req.keyDetails or base.get("keyDetails") or []

    result = map_item_to_avatar(
        category=category,
        type_=type_,
        primary_color=primary,
        secondary_color=secondary,
        pattern=pattern,
        material=material,
        fit=fit,
        key_details=key_details,
    )

    return AvatarMappingResult(
        avatarCategory=result["avatarCategory"],
        avatarAssetFamily=result["avatarAssetFamily"],
        materialPreset=result["materialPreset"],
        patternPreset=result["patternPreset"],
        palette=AvatarPalette(
            primary=result["palette"]["primary"],
            secondary=result["palette"]["secondary"],
        ),
        fitPreset=result["fitPreset"],
        renderHints=AvatarRenderHints(**result["renderHints"]),
        inputCategory=result["inputCategory"],
        inputType=result["inputType"],
    )


@app.post("/remove-bg", response_model=RemoveBgResponse, dependencies=[Depends(_require_internal_token)])
def remove_bg_endpoint(req: RemoveBgRequest):
    """
    Lightweight background-removal only. No Vision AI.
    Used for back images: fetch RAW → rembg → upload CLEAN → return cleanUrl.
    Called by Node only (server-to-server).
    """
    print(f"[API] remove-bg for userId={req.userId}")
    try:
        result = remove_bg_only(req.userId, req.rawUrl)
        return RemoveBgResponse(**result)
    except Exception as e:
        print(f"[API] remove-bg error: {e}")
        return RemoveBgResponse(status="failed", cleanUrl=None, failReason=str(e))


@app.post("/process-item", response_model=ProcessItemResponse, dependencies=[Depends(_require_internal_token)])
def process_item_endpoint(req: ProcessItemRequest):
    """
    v1 pipeline: fetch RAW from rawUrl → rembg → upload CLEAN to R2 → OpenAI Vision → return profile.
    Called by Node only (server-to-server).
    """
    # Avoid logging full rawUrl (may contain tokens in some setups)
    print(f"[API] process-item for userId={req.userId}, rawKey={req.rawKey[:50]}..., clothingType={req.clothingType}")
    try:
        result = process_item(req.userId, req.rawKey, req.rawUrl, clothing_type=req.clothingType)
        return ProcessItemResponse(**result)
    except VisionFailedError as e:
        print(f"[API] process-item Vision failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        print(f"[API] process-item error: {e}")
        return ProcessItemResponse(
            status="failed",
            cleanKey=None,
            cleanUrl=None,
            profile=None,
            failReason=str(e),
        )
