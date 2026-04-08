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

const OCCASION_KEYWORDS: { keywords: string[]; occasion: string }[] = [
  {
    keywords: ['interview', 'meeting', 'presentation', 'conference', 'board', 'client', 'office', 'work', 'standup', 'sync'],
    occasion: 'business formal',
  },
  {
    keywords: ['gym', 'workout', 'yoga', 'run', 'training', 'sport', 'fitness', 'exercise'],
    occasion: 'athletic',
  },
  {
    keywords: ['dinner', 'date', 'anniversary', 'restaurant', 'gala', 'wedding', 'party', 'cocktail'],
    occasion: 'evening',
  },
  {
    keywords: ['brunch', 'lunch', 'coffee', 'cafe', 'friends', 'hangout', 'casual'],
    occasion: 'casual',
  },
  {
    keywords: ['travel', 'flight', 'airport', 'trip', 'vacation', 'holiday'],
    occasion: 'travel',
  },
];

export function mapEventsToOccasionHint(
  events: DeviceCalendarEvent[]
): string | null {
  if (events.length === 0) return null;

  for (const event of events) {
    const text = `${event.title} ${event.notes ?? ''} ${event.location ?? ''}`.toLowerCase();
    for (const { keywords, occasion } of OCCASION_KEYWORDS) {
      if (keywords.some(kw => text.includes(kw))) {
        return occasion;
      }
    }
  }

  // Default: if events exist but no keyword match, suggest smart casual
  return 'smart casual';
}

export function formatEventTime(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
