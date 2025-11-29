// Frontend configuration

// Node / main app backend
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.trim() !== ''
    ? process.env.EXPO_PUBLIC_API_URL.trim()
    : 'http://localhost:5001';

// Python AI backend
export const AI_BASE_URL =
  process.env.EXPO_PUBLIC_AI_BASE_URL && process.env.EXPO_PUBLIC_AI_BASE_URL.trim() !== ''
    ? process.env.EXPO_PUBLIC_AI_BASE_URL.trim()
    : 'http://localhost:8000';

// AI feature flag
export const ENABLE_AI = (process.env.EXPO_PUBLIC_ENABLE_AI ?? 'false').toLowerCase() === 'true';

// Runtime logging - shows exactly which URL is being used
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('[Config] ========================================');
  console.log('[Config] API_BASE_URL =', API_BASE_URL);
  console.log('[Config] AI_BASE_URL =', AI_BASE_URL);
  console.log('[Config] ENABLE_AI =', ENABLE_AI);
  console.log('[Config] EXPO_PUBLIC_API_URL =', process.env.EXPO_PUBLIC_API_URL || '(not set, using default)');
  console.log('[Config] ========================================');
}

