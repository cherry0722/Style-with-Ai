/**
 * Home Daily Hub — GET /api/home/today
 * Uses API_BASE_URL (Node). Optional lat/lon for weather.
 */
import client from './client';

export interface HomeTodayWeather {
  ok: boolean;
  tempF: number | null;
  condition: string | null;
  source: string | null;
  cached: boolean;
  message: string | null;
}

export interface HomeTodayPlan {
  slotLabel: string;
  occasion: string;
  outfitId: string;
  status: 'planned' | 'worn' | 'skipped';
  notes: string;
}

export interface HomeTodayResponse {
  date: string;
  weather: HomeTodayWeather;
  plans: HomeTodayPlan[];
}

const HOME_TODAY_PATH = '/api/home/today';

/**
 * GET /api/home/today?lat=...&lon=...
 * If lat/lon omitted, backend returns weather.ok=false and plans.
 */
export async function fetchHomeToday(params?: { lat?: number; lon?: number }): Promise<HomeTodayResponse> {
  const lat = params?.lat;
  const lon = params?.lon;
  const hasLocation = lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon);
  const url = hasLocation ? `${HOME_TODAY_PATH}?lat=${lat}&lon=${lon}` : HOME_TODAY_PATH;

  if (__DEV__) {
    console.log('[Home API] GET', HOME_TODAY_PATH, hasLocation ? 'with lat/lon' : 'without lat/lon');
  }

  const res = await client.get<HomeTodayResponse>(url);
  const data = res.data;

  if (__DEV__) {
    console.log('[Home API] response.weather.ok =', data?.weather?.ok ?? false);
  }

  return data;
}
