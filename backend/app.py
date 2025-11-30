# app.py
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from .env
load_dotenv()

from schemas.models import SuggestRequest, RecommendResponse
from ai.agent import MyraAgent
from db.mongo import db, _client, USE_MOCK_DB_ENV

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
    if USE_MOCK_DB_ENV or _client is None:
        return {"status": "healthy", "database": "mock"}
    try:
        _client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB down: {e}")


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
