import RNCalendarEvents, {
  CalendarEventReadable,
} from 'react-native-calendar-events';

export interface DeviceCalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
}

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestCalendarPermission(): Promise<boolean> {
  try {
    const status = await RNCalendarEvents.requestPermissions();
    return status === 'authorized';
  } catch {
    return false;
  }
}

export async function checkCalendarPermission(): Promise<boolean> {
  try {
    const status = await RNCalendarEvents.checkPermissions();
    return status === 'authorized';
  } catch {
    return false;
  }
}

// ── Fetch events for a specific date ─────────────────────────────────────────

export async function fetchEventsForDate(
  date: string // YYYY-MM-DD
): Promise<DeviceCalendarEvent[]> {
  try {
    const start = new Date(date + 'T00:00:00');
    const end = new Date(date + 'T23:59:59.999');

    const events: CalendarEventReadable[] = await RNCalendarEvents.fetchAllEvents(
      start.toISOString(),
      end.toISOString(),
      { fetchAllDayEvents: true }
    );

    return events.map(e => ({
      id: e.id ?? '',
      title: e.title ?? 'Event',
      startDate: e.startDate ?? '',
      endDate: e.endDate ?? '',
      location: e.location ?? undefined,
      notes: e.notes ?? undefined,
    }));
  } catch {
    return [];
  }
}

// ── Map events → occasion hint for AI ────────────────────────────────────────

export function mapEventsToOccasionHint(
  events: DeviceCalendarEvent[]
): string | null {
  if (events.length === 0) return null;

  // Build enriched context string for each event
  // More context = better LLM reasoning (prompt engineering best practice)
  const buildEventContext = (event: DeviceCalendarEvent): string => {
    const parts: string[] = [event.title];
    if (event.location) parts.push(`at ${event.location}`);
    if (event.notes) parts.push(event.notes.slice(0, 80)); // cap notes length
    return parts.join(', ');
  };

  // Step 1 — Try keyword matching for high-confidence cases
  // These are unambiguous signals where keyword wins over LLM inference
  const HIGH_CONFIDENCE_KEYWORDS: { keywords: string[]; occasion: string }[] = [
    {
      keywords: ['gym', 'workout', 'yoga', 'run', 'running', 'training',
                 'sport', 'fitness', 'exercise', 'crossfit', 'pilates', 'swim'],
      occasion: 'athletic wear',
    },
    {
      keywords: ['black tie', 'gala', 'formal dinner', 'awards ceremony',
                 'red carpet'],
      occasion: 'black tie formal',
    },
    {
      keywords: ['beach', 'pool', 'swim'],
      occasion: 'beach casual',
    },
  ];

  for (const event of events) {
    const text = buildEventContext(event).toLowerCase();
    for (const { keywords, occasion } of HIGH_CONFIDENCE_KEYWORDS) {
      if (keywords.some(kw => text.includes(kw))) {
        return occasion;
      }
    }
  }

  // Step 2 — For everything else, pass enriched raw context to the LLM
  // The LLM is a better classifier than any keyword table for:
  // meetings, dinners, appointments, birthdays, travel, classes, etc.
  // Prompt engineering principle: natural language > category labels
  // for generative models
  if (events.length === 1) {
    return buildEventContext(events[0]);
  }

  // Multiple events — build a combined context string
  // LLM will reason about the most formal requirement across the day
  // (dressing for the most important event is sound fashion advice)
  const contexts = events
    .slice(0, 3) // cap at 3 events to avoid token bloat
    .map(buildEventContext)
    .join('; ');

  return `day includes: ${contexts}`;
}

export function formatEventTime(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
