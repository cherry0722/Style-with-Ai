# app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.agent import router as agent_router
from routes.feedback import router as feedback_router

app = FastAPI(title="MYRA Backend", version="0.1.0")

# CORS configuration
origins = [
    "http://localhost:19006",  # Expo web
    "exp://localhost:19000",   # Expo development
    "http://localhost:3000",   # Frontend development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

@app.get("/")
def root():
    return {"message": "MYRA backend is running"}

# Register routes
app.include_router(agent_router, prefix="/agent", tags=["Agent"])
app.include_router(feedback_router, prefix="/feedback", tags=["Feedback"])
