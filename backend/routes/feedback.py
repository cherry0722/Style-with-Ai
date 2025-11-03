from fastapi import APIRouter
from pydantic import BaseModel
from db.mongo import get_user_profile, save_user_profile, get_user_wardrobe
from ai.preference import update_profile_counts, recompute_user_vec

router = APIRouter(prefix="/feedback", tags=["Feedback"])

class FeedbackIn(BaseModel):
    user_id: str
    outfit_items: list[str]
    label: str  # "like" | "dislike"

@router.post("")
def submit_feedback(fb: FeedbackIn):
    up = get_user_profile(fb.user_id) or {"_id": fb.user_id, "liked_item_ids": [], "disliked_item_ids": []}

    # Bookkeeping lists
    if fb.label == "like":
        up["liked_item_ids"] = list(set(up.get("liked_item_ids", []) + fb.outfit_items))
    else:
        up["disliked_item_ids"] = list(set(up.get("disliked_item_ids", []) + fb.outfit_items))

    # Count preferences (color/fabric/formality)
    # You can fetch item metadata from Mongo to update counts accurately:
    from db.mongo import get_items_by_ids
    items = get_items_by_ids(fb.user_id, fb.outfit_items)
    up = update_profile_counts(up, items, fb.label)

    # Recompute user vector centroid from liked items
    wardrobe = get_user_wardrobe(fb.user_id)
    uvec = recompute_user_vec(wardrobe, up.get("liked_item_ids", []))
    if uvec is not None:
        up["user_vec"] = uvec

    save_user_profile(up)
    return {"ok": True}
