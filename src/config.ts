// Frontend configuration
// Only EXPO_PUBLIC_* variables are available in the Expo app at runtime.

// Node / main app backend
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.trim() !== ''
    ? process.env.EXPO_PUBLIC_API_URL.trim()
    : 'https://style-with-ai-node.onrender.com';

/** Alias for API_BASE_URL (used by api layer). */
export const BASE_URL = API_BASE_URL;

// AI base URL (Expo client) — points to Node /api/ai by default
export const AI_BASE_URL =
  process.env.EXPO_PUBLIC_AI_BASE_URL && process.env.EXPO_PUBLIC_AI_BASE_URL.trim() !== ''
    ? process.env.EXPO_PUBLIC_AI_BASE_URL.trim()
    : `${API_BASE_URL.replace(/\/$/, '')}/api/ai`;

// AI feature flag — ONLY from EXPO_PUBLIC_ENABLE_AI (strict 'true' string; no other env fallback)
const rawEnableAi = process.env.EXPO_PUBLIC_ENABLE_AI;
export const ENABLE_AI = rawEnableAi === 'true';

// Runtime logging (dev only): raw value + computed boolean so env loading is verifiable
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('[Config] ========================================');
  console.log('[Config] API_BASE_URL =', API_BASE_URL);
  console.log('[Config] AI_BASE_URL =', AI_BASE_URL);
  console.log('[Config] EXPO_PUBLIC_ENABLE_AI (raw) =', rawEnableAi === undefined ? '(undefined)' : JSON.stringify(rawEnableAi));
  console.log('[Config] ENABLE_AI (computed) =', ENABLE_AI);
  console.log('[Config] EXPO_PUBLIC_API_URL (raw) =', process.env.EXPO_PUBLIC_API_URL === undefined ? '(not set)' : '(set)');
  if (rawEnableAi === undefined) {
    console.warn('[Config] EXPO_PUBLIC_ENABLE_AI is undefined. Check .env placement and restart with -c');
  }
  console.log('[Config] ========================================');
}
