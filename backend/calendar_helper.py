import os
import datetime
from typing import List, Dict, Any

"""
Optional calendar integration helper.

Behavior:
- If CALENDAR_ENABLED != 'true', functions return an empty list (calendar is optional).
- If CALENDAR_MOCK == 'true', returns sample events for the current day (useful for local dev/tests).
- Real provider integrations (Google / Outlook) are intentionally left as placeholders
  to avoid adding heavy deps; they can be implemented later and gated behind env vars.
"""


def _mock_events_for_today() -> List[Dict[str, Any]]:
    today = datetime.date.today().isoformat()
    return [
        {"title": "Morning workout (gym)", "start": f"{today}T07:00:00", "end": f"{today}T08:00:00"},
        {"title": "Client meeting", "start": f"{today}T10:00:00", "end": f"{today}T11:00:00"},
        {"title": "Dinner with friends", "start": f"{today}T19:00:00", "end": f"{today}T21:00:00"},
    ]


def get_events_for_today(user_id: str) -> List[Dict[str, Any]]:
    """Return a list of events for the current day for the provided user.

    The function is intentionally conservative: if calendar access is not enabled or not
    configured, it returns an empty list. Use CALENDAR_MOCK=true to get sample events.
    """
    enabled = os.getenv('CALENDAR_ENABLED', 'false').lower() == 'true'
    if not enabled:
        return []

    # Mock mode for dev/testing
    if os.getenv('CALENDAR_MOCK', 'false').lower() == 'true':
        return _mock_events_for_today()

    # Placeholder for real provider logic
    provider = os.getenv('CALENDAR_PROVIDER', '').lower()
    if provider == 'google':
        # TODO: implement Google Calendar fetch using service account / OAuth tokens
        # Return [] until implemented
        return []
    if provider in ('outlook', 'microsoft'):
        # TODO: implement Microsoft Graph calendar fetch
        return []

    # Default: no provider available
    return []
