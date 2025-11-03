# routes/feedback.py
from fastapi import APIRouter
from schemas.models import FeedbackIn
from db.mongo import (
    get_user_profile,
    save_user_profile,
    get_user_wardrobe,
    get_items_by_ids,
)
from ai.preference import update_profile_counts, recompute_user_vec

router = APIRouter()


@router.post("")
def submit_feedback(fb: FeedbackIn):
    """
    Endpoint to register 'like' / 'dislike' feedback for a suggested outfit.
    This updates the long-term user profile and preference vectors.
    """
    up = get_user_profile(fb.user_id) or {"_id": fb.user_id}

    liked_ids = set(up.get("liked_item_ids", []))
    disliked_ids = set(up.get("disliked_item_ids", []))

    if fb.label == "like":
        liked_ids.update(fb.outfit_items)
        # optional: remove from disliked
        disliked_ids.difference_update(fb.outfit_items)
    else:
        disliked_ids.update(fb.outfit_items)

    up["liked_item_ids"] = list(liked_ids)
    up["disliked_item_ids"] = list(disliked_ids)

    # Update preference counts based on item metadata
    items = get_items_by_ids(fb.user_id, fb.outfit_items)
    up = update_profile_counts(up, items, fb.label)

    # Recompute user_vec from liked items
    wardrobe = get_user_wardrobe(fb.user_id)
    uvec = recompute_user_vec(wardrobe, up.get("liked_item_ids", []))
    if uvec is not None:
        up["user_vec"] = uvec

    save_user_profile(up)
    return {"ok": True}
