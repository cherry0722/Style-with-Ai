import os
import json
import datetime
from typing import Any, Dict, List, Optional, Union
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

# Updated env var names per user requirements
MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")  # Support both for backward compat
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME") or os.getenv("MONGO_DB", "style_with_ai")
AI_USE_MOCK_DB = (os.getenv("AI_USE_MOCK_DB", "true").lower() == "true")  # Default to True

# For backward compatibility
MONGO_URI = MONGODB_URI
USE_MOCK_DB_ENV = AI_USE_MOCK_DB
MONGO_DB_NAME = MONGODB_DB_NAME
_client = None

# Module-level DB instance cache
_db_instance = None

# Mock in-memory database for development/testing when MongoDB is unavailable
class MockDB:
    """Simple dictionary-based mock database with support for loading mock data from JSON."""
    def __init__(self, load_from_file=False):
        self.database_type = "mock"
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


# MongoDB wrapper class that provides similar interface to MockDB
class MongoDB:
    """MongoDB wrapper class that provides interface compatible with MockDB."""
    
    def __init__(self, uri: str, db_name: str):
        self.client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        self.db = self.client[db_name]
        self.wardrobes = self.db["wardrobes"]
        self.user_profiles = self.db["user_profiles"]
        self.session_memory = self.db["session_memory"]
        self.database_type = "mongo"
        
    def __getitem__(self, collection_name):
        """Support dictionary-style access for backward compatibility."""
        # Map mock collection names to MongoDB collection names
        if collection_name == 'wardrobe':
            return self.wardrobes  # Maps to "wardrobes" collection
        elif collection_name == 'user_profile':
            return self.user_profiles
        elif collection_name == 'session_memory':
            return self.session_memory
        else:
            return self.db[collection_name]
    
    def _doc_to_wardrobe_item(self, doc: dict) -> Dict[str, Any]:
        """
        Map MongoDB wardrobe document to WardrobeItem-compatible dictionary.
        Handles both Mongoose schema fields and mock data structure.
        """
        # Handle ObjectId for _id
        item_id = str(doc.get("_id", ""))
        
        # Extract user_id (can be ObjectId or string in MongoDB)
        user_id = doc.get("userId", "")
        if isinstance(user_id, ObjectId):
            user_id = str(user_id)
        
        # Map fields from Mongoose schema to WardrobeItem
        # Handle both camelCase (Mongoose) and snake_case variants
        item_type = doc.get("type") or doc.get("category", "")
        category = doc.get("category") or doc.get("type", "")
        
        # Color can be a string or list (colors)
        color = doc.get("color_name") or doc.get("color", "")
        if not color and doc.get("colors") and isinstance(doc.get("colors"), list) and len(doc.get("colors", [])) > 0:
            color = doc.get("colors")[0]
        
        # Fabric
        fabric = doc.get("fabric", "unknown")
        if doc.get("metadata") and doc["metadata"].get("fabric"):
            fabric = doc["metadata"]["fabric"]
        
        # Pattern
        pattern = doc.get("pattern")
        if doc.get("metadata") and doc["metadata"].get("pattern"):
            pattern = doc["metadata"]["pattern"]
        
        # Season
        season = doc.get("seasonTags") or doc.get("season", [])
        if not isinstance(season, list):
            season = [season] if season else []
        
        # Formality
        formality = doc.get("formality")
        
        # Notes
        notes = doc.get("notes")
        
        # Name - construct from category/type if not available
        name = doc.get("name") or category or item_type or "Untitled Item"
        
        # Tags
        tags = doc.get("tags", [])
        if not isinstance(tags, list):
            tags = [tags] if tags else []
        
        # Occasion
        occasion = None
        if doc.get("occasionTags") and isinstance(doc.get("occasionTags"), list) and len(doc.get("occasionTags", [])) > 0:
            occasion = doc.get("occasionTags")[0]
        occasion = occasion or doc.get("occasion")
        
        # Build the WardrobeItem-compatible dict
        wardrobe_item = {
            "user_id": str(user_id),
            "id": item_id,
            "type": item_type or category,
            "category": category or item_type,  # Include for compatibility
            "name": name,
            "color": str(color) if color else "unknown",
            "fabric": str(fabric) if fabric else "unknown",
            "pattern": pattern,
            "season": season if isinstance(season, list) else ([season] if season else None),
            "formality": formality,
            "notes": notes,
            "imageUrl": doc.get("imageUrl") or doc.get("image_url"),  # Include for compatibility
            "cleanImageUrl": doc.get("cleanImageUrl") or doc.get("clean_image_url"),  # Include for compatibility
            "uri": doc.get("imageUrl") or doc.get("image_url"),  # Agent uses this
            "image_url": doc.get("imageUrl") or doc.get("image_url"),  # Agent uses this
            "isFavorite": doc.get("isFavorite", False),
            "tags": tags,
            "occasion": occasion,
        }
        
        # Remove None values for cleaner output
        return {k: v for k, v in wardrobe_item.items() if v is not None}
    
    def get_user_wardrobe(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all wardrobe items for a user. Returns list of WardrobeItem-compatible dicts."""
        if not user_id:
            return []
        
        query_variants = []
        
        # Primary: Mongoose-style userId as ObjectId
        try:
            user_oid = ObjectId(user_id)
            query_variants.append({"userId": user_oid})
        except Exception as e:
            print(f"[DB] user_id '{user_id}' is not a valid ObjectId for userId: {e}")
        
        # Fallback: userId stored as string
        query_variants.append({"userId": user_id})
        
        # Legacy/alternate: user_id field
        try:
            user_oid = ObjectId(user_id)
            query_variants.append({"user_id": user_oid})
        except Exception:
            pass
        
        query_variants.append({"user_id": user_id})
        
        for q in query_variants:
            docs = list(self.wardrobes.find(q))
            if docs:
                print(f"[DB] get_user_wardrobe matched {len(docs)} docs with query={q}")
                return [self._doc_to_wardrobe_item(doc) for doc in docs]
        
        print(f"[DB] No wardrobe items found for user_id={user_id} using queries={query_variants}")
        return []
    
    def get_items_by_ids(self, user_id: str, ids: List[str]) -> List[Dict[str, Any]]:
        """Get wardrobe items by IDs for a user. Returns list of WardrobeItem-compatible dicts."""
        if not ids:
            return []
        
        object_ids = []
        for _id in ids:
            try:
                object_ids.append(ObjectId(_id))
            except Exception as e:
                print(f"[DB] Skipping invalid wardrobe item id '{_id}': {e}")
        
        if not object_ids:
            return []
        
        query_variants = []
        
        # Primary: userId as ObjectId
        try:
            user_oid = ObjectId(user_id)
            query_variants.append({"_id": {"$in": object_ids}, "userId": user_oid})
        except Exception as e:
            print(f"[DB] user_id '{user_id}' is not a valid ObjectId for get_items_by_ids: {e}")
        
        # Fallback: userId stored as string
        query_variants.append({"_id": {"$in": object_ids}, "userId": user_id})
        
        # Legacy/alternate user_id field
        try:
            user_oid = ObjectId(user_id)
            query_variants.append({"_id": {"$in": object_ids}, "user_id": user_oid})
        except Exception:
            pass
        
        query_variants.append({"_id": {"$in": object_ids}, "user_id": user_id})
        
        for q in query_variants:
            docs = list(self.wardrobes.find(q))
            if docs:
                print(f"[DB] get_items_by_ids matched {len(docs)} docs with query={q}")
                return [self._doc_to_wardrobe_item(doc) for doc in docs]
        
        print(f"[DB] No wardrobe items found for ids={ids} and user_id={user_id} using queries={query_variants}")
        return []


def _doc_to_wardrobe_item(doc: dict) -> Dict[str, Any]:
    """
    Map MongoDB wardrobe document to WardrobeItem-compatible dictionary.
    Handles both Mongoose schema fields and mock data structure.
    """
    # Handle ObjectId for _id
    item_id = str(doc.get("_id", ""))
    
    # Extract user_id (can be ObjectId or string in MongoDB)
    user_id = doc.get("userId", "")
    if isinstance(user_id, ObjectId):
        user_id = str(user_id)
    
    # Map fields from Mongoose schema to WardrobeItem
    # Handle both camelCase (Mongoose) and snake_case variants
    item_type = doc.get("type") or doc.get("category", "")
    category = doc.get("category") or doc.get("type", "")
    
    # Color can be a string or list (colors)
    color = doc.get("color_name") or doc.get("color", "")
    if not color and doc.get("colors") and len(doc.get("colors", [])) > 0:
        color = doc.get("colors")[0]
    
    # Fabric
    fabric = doc.get("fabric", "unknown")
    if doc.get("metadata") and doc["metadata"].get("fabric"):
        fabric = doc["metadata"]["fabric"]
    
    # Pattern
    pattern = doc.get("pattern")
    if doc.get("metadata") and doc["metadata"].get("pattern"):
        pattern = doc["metadata"]["pattern"]
    
    # Season
    season = doc.get("seasonTags") or doc.get("season", [])
    
    # Formality
    formality = doc.get("formality")
    
    # Notes
    notes = doc.get("notes")
    
    # Name - construct from category/type if not available
    name = doc.get("name") or category or item_type or "Untitled Item"
    
    # Build the WardrobeItem-compatible dict
    wardrobe_item = {
        "user_id": str(user_id),
        "id": item_id,
        "type": item_type or category,
        "category": category or item_type,  # Include for compatibility
        "name": name,
        "color": str(color) if color else "unknown",
        "fabric": str(fabric) if fabric else "unknown",
        "pattern": pattern,
        "season": season if isinstance(season, list) else ([season] if season else None),
        "formality": formality,
        "notes": notes,
        "imageUrl": doc.get("imageUrl") or doc.get("image_url"),  # Include for compatibility
        "cleanImageUrl": doc.get("cleanImageUrl") or doc.get("clean_image_url"),  # Include for compatibility
        "uri": doc.get("imageUrl") or doc.get("image_url"),  # Agent uses this
        "image_url": doc.get("imageUrl") or doc.get("image_url"),  # Agent uses this
        "isFavorite": doc.get("isFavorite", False),
        "tags": doc.get("tags", []),
    }
    
    # Remove None values for cleaner output
    return {k: v for k, v in wardrobe_item.items() if v is not None}

def get_db():
    """
    Get DB instance (cached). Returns either MockDB or MongoDB wrapper.
    """
    global _db_instance, _client
    
    if _db_instance is not None:
        return _db_instance
    
    # Check if we should use mock DB
    if AI_USE_MOCK_DB or not MONGODB_URI:
        print("[DB] Using MockDB (AI_USE_MOCK_DB=true or no MONGODB_URI)")
        _db_instance = MockDB(load_from_file=True)
        return _db_instance
    
    # Try to connect to real MongoDB
    try:
        mongodb = MongoDB(MONGODB_URI, MONGODB_DB_NAME)
        # Test connection
        mongodb.client.admin.command('ping')
        _client = mongodb.client
        _db_instance = mongodb
        print(f"[DB] Connected to MongoDB: db={MONGODB_DB_NAME}")
        return _db_instance
    except (PyMongoError, Exception) as e:
        print(f"[DB] Failed to connect to MongoDB: {e}")
        print("[DB] Falling back to MockDB")
        _db_instance = MockDB(load_from_file=True)
        return _db_instance


def get_user_wardrobe(user_id: str) -> List[Dict[str, Any]]:
    """Get all wardrobe items for a user. Returns list of dicts compatible with WardrobeItem."""
    db = get_db()
    
    # Check if it's MockDB
    if hasattr(db, 'database_type') and db.database_type == "mongo":
        # Real MongoDB - use the class method
        return db.get_user_wardrobe(user_id)
    else:
        # MockDB
        results = list(db['wardrobe'].find({"user_id": user_id}))
        return results


def get_items_by_ids(user_id: str, ids: List[str]) -> List[Dict[str, Any]]:
    """Get wardrobe items by IDs for a user. Returns list of dicts compatible with WardrobeItem."""
    db = get_db()
    
    # Check if it's MockDB
    if hasattr(db, 'database_type') and db.database_type == "mongo":
        # Real MongoDB - use the class method
        return db.get_items_by_ids(user_id, ids)
    else:
        # MockDB
        results = list(db['wardrobe'].find({"user_id": user_id, "id": {"$in": ids}}))
        return results


# Initialize db for backward compatibility
# This ensures existing imports like "from db.mongo import db" still work
# The actual instance will be created on first access via get_db()
class _LazyDB:
    """Lazy wrapper for backward compatibility."""
    def __getattr__(self, name):
        return getattr(get_db(), name)
    
    def __getitem__(self, key):
        return get_db()[key]

db = _LazyDB()

def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user profile by user_id."""
    db = get_db()
    if hasattr(db, 'database_type') and db.database_type == "mongo":
        try:
            query_user_id = user_id
            try:
                query_user_id = ObjectId(user_id)
            except (ValueError, TypeError):
                pass
            return db.user_profiles.find_one({"_id": query_user_id})
        except Exception as e:
            print(f"[DB] Error fetching user profile: {e}")
            return None
    else:
        return db['user_profile'].find_one({"_id": user_id})


def save_user_profile(up: Dict[str, Any]):
    """Save user profile."""
    db = get_db()
    up["last_updated"] = datetime.datetime.utcnow().isoformat()
    if hasattr(db, 'database_type') and db.database_type == "mongo":
        try:
            user_id = up.get("_id")
            query_user_id = user_id
            try:
                query_user_id = ObjectId(user_id)
            except (ValueError, TypeError):
                pass
            db.user_profiles.update_one({"_id": query_user_id}, {"$set": up}, upsert=True)
        except Exception as e:
            print(f"[DB] Error saving user profile: {e}")
    else:
        db['user_profile'].update_one({"_id": up["_id"]}, {"$set": up}, upsert=True)


# Short-term memory (optional)
def append_session_turn(session_id: str, user_id: str, user_text: str, agent_text: str, ttl_hours=48):
    """Append a session turn to memory."""
    db = get_db()
    expiry = (datetime.datetime.utcnow() + datetime.timedelta(hours=ttl_hours)).isoformat()
    if hasattr(db, 'database_type') and db.database_type == "mongo":
        try:
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
        except Exception as e:
            print(f"[DB] Error appending session turn: {e}")
    else:
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
