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

from schemas.models import SuggestRequest, RecommendResponse, ProcessItemRequest, ProcessItemResponse
from ai.agent import MyraAgent
from db.mongo import get_db
from services.process_item import process_item, VisionFailedError

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
    """Health check endpoint."""
    db = get_db()
    
    # Check database type
    if hasattr(db, 'database_type'):
        db_type = db.database_type
        if db_type == "mongo":
            try:
                db.client.admin.command('ping')
                return {"status": "healthy", "database": "mongo"}
            except Exception as e:
                raise HTTPException(status_code=503, detail=f"DB down: {e}")
    
    # Default to mock
    return {"status": "healthy", "database": "mock"}


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


@app.post("/process-item", response_model=ProcessItemResponse, dependencies=[Depends(_require_internal_token)])
def process_item_endpoint(req: ProcessItemRequest):
    """
    v1 pipeline: fetch RAW from rawUrl → rembg → upload CLEAN to R2 → OpenAI Vision → return profile.
    Called by Node only (server-to-server).
    """
    # Avoid logging full rawUrl (may contain tokens in some setups)
    print(f"[API] process-item for userId={req.userId}, rawKey={req.rawKey[:50]}...")
    try:
        result = process_item(req.userId, req.rawKey, req.rawUrl)
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
