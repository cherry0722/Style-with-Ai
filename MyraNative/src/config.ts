/**
 * Frontend configuration — Bare React Native CLI version.
 * Reads from .env via react-native-config (no EXPO_PUBLIC_* prefix).
 * .env keys: API_URL, AI_BASE_URL, ENABLE_AI
 */
import Config from 'react-native-config';

// Node / main app backend
export const API_BASE_URL =
  Config.API_URL?.trim() && Config.API_URL.trim() !== ''
    ? Config.API_URL.trim()
    : 'https://style-with-ai-node.onrender.com';

/** Alias for API_BASE_URL (used by api layer). */
export const BASE_URL = API_BASE_URL;

// AI base URL — points to Python microservice or Node /api/ai fallback
export const AI_BASE_URL =
  Config.AI_BASE_URL?.trim() && Config.AI_BASE_URL.trim() !== ''
    ? Config.AI_BASE_URL.trim()
    : `${API_BASE_URL.replace(/\/$/, '')}/api/ai`;

// AI feature flag — strict 'true' string check
export const ENABLE_AI = Config.ENABLE_AI === 'true';

// Runtime logging (dev only)
if (__DEV__) {
  console.log('[Config] ========================================');
  console.log('[Config] API_BASE_URL =', API_BASE_URL);
  console.log('[Config] AI_BASE_URL  =', AI_BASE_URL);
  console.log('[Config] ENABLE_AI    =', ENABLE_AI);
  console.log('[Config] ========================================');
}
