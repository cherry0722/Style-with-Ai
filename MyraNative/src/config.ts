/**
 * Frontend configuration — Bare React Native CLI version.
 * Reads from .env via react-native-config (no EXPO_PUBLIC_* prefix).
 * .env keys: API_URL, AI_BASE_URL, ENABLE_AI
 *
 * MIGRATION NOTE (temporary):
 *   react-native-config requires a native iOS Build Phase (Pre-actions script)
 *   to populate Config.* at runtime. That wiring is deferred until MyraNative
 *   moves to the repo root and gets a proper production build setup.
 *
 *   During this migration phase the __DEV__ fallbacks below point at localhost
 *   so the iOS Simulator reaches the local backends without any Xcode edits.
 *   The production fallback (Render) is preserved for non-dev builds.
 *
 *   TODO (when moving to root): wire react-native-config Build Phase in Xcode,
 *   then remove the DEV_FALLBACK_* constants and collapse back to a single
 *   ternary with only the Render production fallback.
 */
import Config from 'react-native-config';

// --- MIGRATION-PHASE DEV FALLBACKS (remove when react-native-config is wired) ---
const DEV_FALLBACK_API_URL = 'http://localhost:5001';
const DEV_FALLBACK_AI_URL  = 'http://localhost:5002';
// ---------------------------------------------------------------------------------

// Node / main app backend
export const API_BASE_URL =
  Config.API_URL?.trim() && Config.API_URL.trim() !== ''
    ? Config.API_URL.trim()
    : __DEV__
      ? DEV_FALLBACK_API_URL
      : 'https://style-with-ai-node.onrender.com';

/** Alias for API_BASE_URL (used by api layer). */
export const BASE_URL = API_BASE_URL;

// AI base URL — points to Python microservice or Node /api/ai fallback
export const AI_BASE_URL =
  Config.AI_BASE_URL?.trim() && Config.AI_BASE_URL.trim() !== ''
    ? Config.AI_BASE_URL.trim()
    : __DEV__
      ? DEV_FALLBACK_AI_URL
      : `${API_BASE_URL.replace(/\/$/, '')}/api/ai`;

// AI feature flag — strict 'true' string check
export const ENABLE_AI = Config.ENABLE_AI === 'true';

// Runtime logging (dev only)
if (__DEV__) {
  console.log('[Config] ========================================');
  // If Config.API_URL is undefined here, react-native-config Build Phase is not wired yet
  // (expected during migration — DEV_FALLBACK_API_URL is active)
  console.log('[Config] Config.API_URL (raw) =', Config.API_URL);
  console.log('[Config] API_BASE_URL =', API_BASE_URL);
  console.log('[Config] AI_BASE_URL  =', AI_BASE_URL);
  console.log('[Config] ENABLE_AI    =', ENABLE_AI);
  console.log('[Config] ========================================');
}
