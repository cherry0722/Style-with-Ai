/**
 * Shared weather/location context store.
 *
 * HomeScreen writes here after fetching weather via /api/home/today.
 * Suggestion screens read here to pass context to /api/ai/reasoned_outfits.
 *
 * If weather or location is unavailable, values remain null — callers
 * must handle the absence gracefully (omit context from the request).
 */
import { create } from 'zustand';

interface WeatherContextState {
  /** Current temperature in Fahrenheit, or null if unavailable. */
  tempF: number | null;
  /** Current weather condition string, or null if unavailable. */
  condition: string | null;
  /** User's latitude, or null if location is unavailable / denied. */
  latitude: number | null;
  /** User's longitude, or null if location is unavailable / denied. */
  longitude: number | null;
  /** Set weather data (from HomeScreen's /api/home/today response). */
  setWeather: (tempF: number | null, condition: string | null) => void;
  /** Set location coordinates (from HomeScreen's geolocation). */
  setLocation: (latitude: number | null, longitude: number | null) => void;
}

export const useWeatherContext = create<WeatherContextState>((set) => ({
  tempF: null,
  condition: null,
  latitude: null,
  longitude: null,
  setWeather: (tempF, condition) => set({ tempF, condition }),
  setLocation: (latitude, longitude) => set({ latitude, longitude }),
}));

/**
 * Build the `context` object for ReasonedOutfitsRequest.
 * Returns undefined if no weather AND no location data is available,
 * so the request body stays clean (no empty context object).
 */
export function buildSuggestionContext(): {
  weather?: { tempF?: number; condition?: string };
  location?: { latitude?: number; longitude?: number };
} | undefined {
  const { tempF, condition, latitude, longitude } = useWeatherContext.getState();

  const hasWeather = tempF != null;
  const hasLocation = latitude != null && longitude != null;

  if (!hasWeather && !hasLocation) return undefined;

  const ctx: {
    weather?: { tempF?: number; condition?: string };
    location?: { latitude?: number; longitude?: number };
  } = {};

  if (hasWeather) {
    ctx.weather = { tempF: tempF! };
    if (condition) ctx.weather.condition = condition;
  }

  if (hasLocation) {
    ctx.location = { latitude: latitude!, longitude: longitude! };
  }

  return ctx;
}
