import os
import datetime
from typing import List, Dict, Any
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable is required")

try:
    _client = MongoClient(MONGO_URI)
    _client.admin.command('ping')
except PyMongoError as e:
    raise ConnectionError(f"Failed to connect to MongoDB: {e}")

db = _client[os.getenv("MONGO_DB", "style_with_ai")]

def get_user_wardrobe(user_id: str) -> List[Dict[str, Any]]:
    return list(db.wardrobe.find({"user_id": user_id}))

def get_items_by_ids(user_id: str, ids: List[str]) -> List[Dict[str, Any]]:
    return list(db.wardrobe.find({"user_id": user_id, "id": {"$in": ids}}))

def get_user_profile(user_id: str) -> Dict[str, Any] | None:
    return db.user_profile.find_one({"_id": user_id})

def save_user_profile(up: Dict[str, Any]):
    up["last_updated"] = datetime.datetime.utcnow().isoformat()
    db.user_profile.update_one({"_id": up["_id"]}, {"$set": up}, upsert=True)

# Short-term memory (optional)
def append_session_turn(session_id: str, user_id: str, user_text: str, agent_text: str, ttl_hours=48):
    expiry = (datetime.datetime.utcnow() + datetime.timedelta(hours=ttl_hours)).isoformat()
    db.session_memory.update_one(
        {"_id": session_id},
        {
            "$setOnInsert": {"user_id": user_id, "expires_at": expiry},
            "$push": {
                "turns": {
                    "ts": datetime.datetime.utcnow().timestamp(),
                    "user": user_text,
                    "agent": agent_text
                }
            }
        },
        upsert=True
    )
