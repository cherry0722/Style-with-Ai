import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import client from '../api/client';
import { useSettings } from '../store/settings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionStartResponse {
  sessionId: string;
  date: string;
  startTime: string;
}

// ─── Module-level state ───────────────────────────────────────────────────────

let activeSessionId: string | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let endRetryTimeout: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTrackingEnabled(): boolean {
  return useSettings.getState().screenTimeTrackingEnabled;
}

function log(msg: string, data?: Record<string, unknown>): void {
  if (__DEV__) {
    console.log(`[ActivityTracker] ${msg}`, data ?? '');
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function callSessionStart(): Promise<string | null> {
  try {
    const res = await client.post<SessionStartResponse>('/api/activity/session-start');
    return res.data.sessionId;
  } catch (err: unknown) {
    log('session-start failed (silent)', { err: String(err) });
    return null;
  }
}

async function callSessionEnd(sessionId: string, attempt = 1): Promise<void> {
  try {
    await client.post('/api/activity/session-end', { sessionId });
    log('session-end ok', { sessionId, attempt });
  } catch (err: unknown) {
    log('session-end failed', { sessionId, attempt, err: String(err) });

    // Retry up to 3 times with exponential backoff (2s, 4s, 8s).
    // Silently give up after that — the backend handles orphaned sessions.
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      if (endRetryTimeout) clearTimeout(endRetryTimeout);
      endRetryTimeout = setTimeout(() => {
        void callSessionEnd(sessionId, attempt + 1);
      }, delay);
    } else {
      log('session-end giving up after retries', { sessionId });
    }
  }
}

// ─── Core session logic ───────────────────────────────────────────────────────

/**
 * Start a new tracking session. No-op if already tracking or feature disabled.
 */
export async function startSession(): Promise<void> {
  if (!isTrackingEnabled()) return;
  if (activeSessionId) {
    log('startSession called but session already active', { activeSessionId });
    return;
  }

  log('starting session');
  const sessionId = await callSessionStart();
  if (sessionId) {
    activeSessionId = sessionId;
    log('session active', { sessionId });
  }
}

/**
 * End the current active session. No-op if no session is open.
 */
export async function endSession(): Promise<void> {
  if (!activeSessionId) return;

  const sessionId = activeSessionId;
  // Clear immediately so concurrent calls don't double-end the same session.
  activeSessionId = null;

  log('ending session', { sessionId });
  await callSessionEnd(sessionId);
}

// ─── AppState handler ─────────────────────────────────────────────────────────

function handleAppStateChange(nextState: AppStateStatus): void {
  if (nextState === 'active') {
    void startSession();
  } else if (nextState === 'background' || nextState === 'inactive') {
    void endSession();
  }
}

// ─── Init / teardown ─────────────────────────────────────────────────────────

/**
 * Set up AppState listeners for automatic session tracking.
 * Call once on app mount. Returns a cleanup function for useEffect.
 *
 * The listener checks `screenTimeTrackingEnabled` at event time, so toggling
 * the setting takes effect immediately without re-initialising.
 */
export function initActivityTracking(): () => void {
  // Avoid double-registering if called more than once
  if (appStateSubscription) {
    log('already initialised, skipping');
    return () => {};
  }

  log('initialising');

  // Start a session immediately if the app is already in the foreground
  if (AppState.currentState === 'active') {
    void startSession();
  }

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    log('tearing down');

    if (endRetryTimeout) {
      clearTimeout(endRetryTimeout);
      endRetryTimeout = null;
    }

    // Best-effort close any open session synchronously on unmount
    if (activeSessionId) {
      const sessionId = activeSessionId;
      activeSessionId = null;
      void callSessionEnd(sessionId);
    }

    appStateSubscription?.remove();
    appStateSubscription = null;
  };
}
