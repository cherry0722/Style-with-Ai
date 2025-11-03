# ai/preference.py
from __future__ import annotations
from typing import List, Dict, Any, Optional
import numpy as np


def _safe_lower(x: Optional[str]) -> str:
    return (x or "").lower()


class PreferenceScorer:
    """
    Reranks wardrobe items using user profile preferences and (optional) base weather score.
    """

    def __init__(self, user_profile: Optional[Dict[str, Any]]):
        self.up = user_profile or {}
        self.col_pref: Dict[str, float] = self.up.get("preferred_colors", {})
        self.fab_pref: Dict[str, float] = self.up.get("preferred_fabrics", {})
        self.form_pref: Dict[str, float] = self.up.get("preferred_formality", {})
        uv = self.up.get("user_vec") or []
        self.user_vec = np.array(uv, dtype=np.float32) if uv else None
        self.disliked = set(self.up.get("disliked_item_ids", []))

    def score(
        self,
        items: List[Dict[str, Any]],
        base_scores: Optional[List[float]] = None,
    ) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for i, it in enumerate(items):
            s = 0.0

            if base_scores is not None and i < len(base_scores):
                s += 0.6 * base_scores[i]

            c = _safe_lower(it.get("color"))
            f = _safe_lower(it.get("fabric"))
            fm = _safe_lower(it.get("formality"))

            s += 0.3 * self.col_pref.get(c, 0.0)
            s += 0.25 * self.fab_pref.get(f, 0.0)
            s += 0.35 * self.form_pref.get(fm, 0.0)

            if self.user_vec is not None and it.get("embedding"):
                item_vec = np.array(it["embedding"], dtype=np.float32)
                # assume already normalized, else normalize
                cos = float(np.dot(self.user_vec, item_vec))
                s += 1.2 * cos

            if it["id"] in self.disliked:
                s -= 5.0

            item_copy = dict(it)
            item_copy["_pref_score"] = s
            out.append(item_copy)

        return sorted(out, key=lambda x: x["_pref_score"], reverse=True)


def update_profile_counts(up: Dict[str, Any], items: List[Dict[str, Any]], label: str) -> Dict[str, Any]:
    mul = 1 if label == "like" else -1
    col = up.setdefault("preferred_colors", {})
    fab = up.setdefault("preferred_fabrics", {})
    form = up.setdefault("preferred_formality", {})

    for it in items:
        c = _safe_lower(it.get("color"))
        f = _safe_lower(it.get("fabric"))
        fm = _safe_lower(it.get("formality"))
        if c:
            col[c] = col.get(c, 0) + mul
        if f:
            fab[f] = fab.get(f, 0) + mul
        if fm:
            form[fm] = form.get(fm, 0) + mul

    return up


def recompute_user_vec(
    wardrobe_items: List[Dict[str, Any]],
    liked_ids: List[str],
) -> Optional[List[float]]:
    liked_set = set(liked_ids)
    vecs = [
        np.array(it["embedding"], dtype=np.float32)
        for it in wardrobe_items
        if it.get("embedding") is not None and it["id"] in liked_set
    ]
    if not vecs:
        return None
    mat = np.stack(vecs, axis=0)
    mean_vec = mat.mean(axis=0)
    norm = np.linalg.norm(mean_vec) + 1e-9
    return (mean_vec / norm).tolist()
