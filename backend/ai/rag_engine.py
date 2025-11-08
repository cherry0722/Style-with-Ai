import os
from typing import Dict, Any, List


def suggest_with_rag(
    user_id: str,
    event_text: str,
    weather: Dict[str, Any],
    wardrobe_items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    RAG engine stub - safe placeholder when AI is disabled or not implemented.
    
    Args:
        user_id: User identifier
        event_text: Event description
        weather: Weather data dictionary
        wardrobe_items: List of wardrobe items
        
    Returns:
        Dictionary with outfits and optional note
    """
    # If AI is disabled, return a predictable placeholder
    if os.getenv("AI_ENABLE", "false").lower() != "true":
        return {
            "outfits": [],
            "note": "RAG disabled. Enable by setting AI_ENABLE=true."
        }
    
    # If someone accidentally calls this with AI enabled but not implemented, fail clearly:
    raise NotImplementedError("RAG not implemented yet. This is a placeholder stub.")

