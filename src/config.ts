// Frontend configuration
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

// Log the API URL for debugging (remove in production)
if (__DEV__) {
  console.log('[Config] API_BASE_URL:', API_BASE_URL);
}

export const ENABLE_AI = (process.env.EXPO_PUBLIC_ENABLE_AI ?? 'false').toLowerCase() === 'true';
export const AI_BASE_URL = process.env.EXPO_PUBLIC_AI_BASE_URL ?? 'http://localhost:8000';

