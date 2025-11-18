# app.py
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from .env
load_dotenv()

from routes.agent import router as agent_router
from routes.feedback import router as feedback_router
from db.mongo import db, _client, USE_MOCK_DB_ENV

app = FastAPI(title="MYRA Backend", version="0.1.0")

# CORS configuration from environment
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
    origins = ["*"]  # dev default

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "MYRA backend is running"}

@app.get("/health")
def health():
    if USE_MOCK_DB_ENV or _client is None:
        return {"status": "healthy", "database": "mock"}
    try:
        _client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB down: {e}")

# Register routes - AI routes are gated by AI_ENABLE flag
# Routes themselves will return 501 if AI is disabled
app.include_router(agent_router, prefix="/agent", tags=["Agent"])
app.include_router(feedback_router, prefix="/feedback", tags=["Feedback"])
