import os
import json
import datetime
from typing import Any, Dict, List, Optional, Union
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv

load_dotenv()

# Updated env var names per user requirements
MONGO_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")  # Support both for backward compat
USE_MOCK_DB_ENV = os.getenv("AI_USE_MOCK_DB", "true").lower() == "true"  # Default to True
MONGO_DB_NAME = os.getenv("MONGODB_DB_NAME") or os.getenv("MONGO_DB", "style_with_ai")
_client = None

# Mock in-memory database for development/testing when MongoDB is unavailable
class MockDB:
    """Simple dictionary-based mock database with support for loading mock data from JSON."""
    def __init__(self, load_from_file=False):
        self.collections = {
            'wardrobe': [],
            'user_profile': {},
            'session_memory': {},
        }
        if load_from_file:
            self._load_mock_data()

    def _load_mock_data(self):
        """Load mock wardrobe and profile data from backend/data/mock_closet.json."""
        try:
            mock_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'mock_closet.json')
            with open(mock_file, 'r') as f:
                data = json.load(f)
                self.collections['wardrobe'] = data.get('wardrobe', [])
                self.collections['user_profile'] = data.get('user_profile', {})
            print("[DB] Mock data loaded from backend/data/mock_closet.json")
        except FileNotFoundError:
            print("[DB] Warning: mock_closet.json not found. Starting with empty collections.")
        except json.JSONDecodeError as e:
            print(f"[DB] Error parsing mock_closet.json: {e}. Starting with empty collections.")

    def __getitem__(self, collection_name):
        if collection_name not in self.collections:
            self.collections[collection_name] = {}
        return MockCollection(self.collections, collection_name)

class MockCollection:
    """Mock collection with find/find_one/update_one/insert_one methods."""
    def __init__(self, collections, name):
        self.collections = collections
        self.name = name

    def find(self, query):
        if self.name == 'wardrobe':
            results = self.collections[self.name]
            if not isinstance(results, list):
                return []
            # Filter by query
            filtered = []
            for item in results:
                match = True
                for key, value in query.items():
                    if key == 'user_id' and item.get('user_id') != value:
                        match = False
                    elif key == 'id' and '$in' in value:
                        if item.get('id') not in value['$in']:
                            match = False
                if match:
                    filtered.append(item)
            return filtered
        return []

    def find_one(self, query):
        if self.name == 'user_profile':
            user_id = query.get('_id')
            return self.collections[self.name].get(user_id)
        return None

    def update_one(self, query, update_ops, upsert=False):
        if self.name == 'session_memory':
            session_id = query.get('_id')
            if session_id not in self.collections[self.name]:
                if upsert:
                    self.collections[self.name][session_id] = {}
                else:
                    return
            doc = self.collections[self.name][session_id]
            if '$setOnInsert' in update_ops:
                doc.update(update_ops['$setOnInsert'])
            if '$push' in update_ops:
                if 'turns' not in doc:
                    doc['turns'] = []
                doc['turns'].append(update_ops['$push']['turns'])
        elif self.name == 'user_profile':
            user_id = query.get('_id')
            if '$set' in update_ops:
                if upsert or user_id in self.collections[self.name]:
                    self.collections[self.name][user_id] = update_ops['$set']

    def insert_one(self, doc):
        if self.name == 'wardrobe':
            if not isinstance(self.collections[self.name], list):
                self.collections[self.name] = []
            self.collections[self.name].append(doc)

if not MONGO_URI or USE_MOCK_DB_ENV:
    print("[DB] Starting in mock database mode.")
    if USE_MOCK_DB_ENV:
        print("[DB] AI_USE_MOCK_DB=true: Loading mock data from JSON.")
    else:
        print("[DB] MONGODB_URI not set. Using mock in-memory database for development.")
    print("[DB] To use MongoDB, set MONGODB_URI environment variable and AI_USE_MOCK_DB=false.")
    db = MockDB(load_from_file=True)
else:
    try:
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        _client.admin.command('ping')
        db = _client[MONGO_DB_NAME]
        print(f"[DB] Connected to MongoDB: {MONGO_DB_NAME}")
    except (PyMongoError, Exception) as e:
        print(f"[DB] Failed to connect to MongoDB: {e}")
        print("[DB] Falling back to mock in-memory database.")
        db = MockDB(load_from_file=True)

def get_user_wardrobe(user_id: str) -> List[Dict[str, Any]]:
    return list(db['wardrobe'].find({"user_id": user_id}))

def get_items_by_ids(user_id: str, ids: List[str]) -> List[Dict[str, Any]]:
    return list(db['wardrobe'].find({"user_id": user_id, "id": {"$in": ids}}))

def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    return db['user_profile'].find_one({"_id": user_id})

def save_user_profile(up: Dict[str, Any]):
    up["last_updated"] = datetime.datetime.utcnow().isoformat()
    db['user_profile'].update_one({"_id": up["_id"]}, {"$set": up}, upsert=True)

# Short-term memory (optional)
def append_session_turn(session_id: str, user_id: str, user_text: str, agent_text: str, ttl_hours=48):
    expiry = (datetime.datetime.utcnow() + datetime.timedelta(hours=ttl_hours)).isoformat()
    db['session_memory'].update_one(
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
