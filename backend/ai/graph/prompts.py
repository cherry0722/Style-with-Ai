"""
Small prompt templates used by the graph pipeline.
This file only contains deterministic templates; real prompts can be fleshed out later.
"""

LLM_SELECTION_PROMPT = """
You are MYRA, a fashion assistant. Given a user's wardrobe, weather, and events, propose one outfit as a list of item ids and a short explanation.
Respond as JSON with structure: {"outfits": [{"items": ["id1","id2"], "why": "reason"}]}
"""

DRAFT_TEMPLATE = """
User: {user_id}\nWeather: {weather}\nEvents: {events}\nWardrobe ids: {wardrobe_ids}\n
Please output a single outfit as JSON with fields items (ids) and why (one sentence).
"""

