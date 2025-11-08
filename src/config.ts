// Frontend configuration for AI features
export const ENABLE_AI = (process.env.EXPO_PUBLIC_ENABLE_AI ?? 'false').toLowerCase() === 'true';
export const AI_BASE_URL = process.env.EXPO_PUBLIC_AI_BASE_URL ?? 'http://localhost:8000';

