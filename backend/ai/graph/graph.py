"""
Simple LangGraph-like pipeline (lightweight) that composes small steps:
 - gather_context: collect wardrobe/weather/events
 - draft: call LLM or stub
 - validate: run basic rule-based checks (e.g., ensure items exist)
 - finalize: format output to RecommendResponse-compatible dict

This is intentionally minimal and avoids external LangGraph dependency.
"""
import os
import json
from typing import Dict, Any, List
from ..agent import MyraAgent  # avoid circular heavy deps; agent will import graph
from ..preference import PreferenceScorer
from ...db.mongo import get_user_wardrobe
from .prompts import DRAFT_TEMPLATE, LLM_SELECTION_PROMPT

LLM_PROVIDER = os.getenv('LLM_PROVIDER')
LLM_MODEL = os.getenv('LLM_MODEL')
LLM_API_KEY = os.getenv('LLM_API_KEY')


def gather_context(user_id: str, location: Dict[str, Any], weather: Dict[str, Any]) -> Dict[str, Any]:
    wardrobe = get_user_wardrobe(user_id) or []
    # Minimal events: agent may enrich with calendar separately
    events = []
    try:
        from ..calendar_helper import get_events_for_today
        events = get_events_for_today(user_id)
    except Exception:
        events = []

    return {
        'user_id': user_id,
        'wardrobe': wardrobe,
        'wardrobe_ids': [i.get('id') for i in wardrobe],
        'weather': weather,
        'location': location,
        'events': events,
    }


def draft_llm(context: Dict[str, Any]) -> Dict[str, Any]:
    """Call configured LLM provider or return a deterministic stub when no key is present."""
    # Prepare prompt
    prompt = DRAFT_TEMPLATE.format(
        user_id=context.get('user_id'),
        weather=json.dumps(context.get('weather')), 
        events=json.dumps(context.get('events')), 
        wardrobe_ids=','.join(context.get('wardrobe_ids', [])),
    )

    if not LLM_API_KEY or LLM_PROVIDER is None:
        # deterministic stub: pick first 3 wardrobe ids
        ids = context.get('wardrobe_ids', [])[:3]
        why = f"Stub: selected {len(ids)} items based on simple rules"
        return {'outfits': [{'items': ids, 'why': why}]}

    # Placeholder: integrate with Azure/OpenAI/Ollama as needed
    # For now, return stub if integration not implemented
    ids = context.get('wardrobe_ids', [])[:3]
    why = f"LLM({LLM_PROVIDER}) stubbed: selected {len(ids)} items"
    return {'outfits': [{'items': ids, 'why': why}]}


def validate_draft(draft: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    # Ensure items exist in wardrobe; drop missing ones
    wardrobe_ids = set(context.get('wardrobe_ids', []))
    cleaned = []
    for o in draft.get('outfits', []):
        items = [i for i in o.get('items', []) if i in wardrobe_ids]
        why = o.get('why')
        cleaned.append({'items': items, 'why': why})
    return {'outfits': cleaned}


def finalize(cleaned: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    # Optionally rerank using preferences
    profile = None
    try:
        from ...db.mongo import get_user_profile
        profile = get_user_profile(context.get('user_id'))
    except Exception:
        profile = None

    if profile:
        scorer = PreferenceScorer(profile)
        # Note: scorer.score expects full items with metadata; we don't rerank here for simplicity
    return {'outfits': cleaned.get('outfits', []), 'context': {'location': context.get('location'), 'weather': context.get('weather')}}


def run_graph(user_id: str, location: Dict[str, Any], weather: Dict[str, Any]) -> Dict[str, Any]:
    ctx = gather_context(user_id, location, weather)
    draft = draft_llm(ctx)
    cleaned = validate_draft(draft, ctx)
    final = finalize(cleaned, ctx)
    return final
