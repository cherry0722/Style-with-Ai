/**
 * Weather API client — all weather data flows through the Node backend.
 * No direct OpenWeather calls from the client.
 */
import client from './client';

export interface BackendWeather {
  summary: string;
  tempF: number;
  precipChance: number;
}

export interface ForecastDay {
  dateISO: string;
  label: string;
  summary: string;
  tempHighF: number;
  tempLowF: number;
  precipChance: number | null;
}

export interface ForecastResponse {
  days: ForecastDay[];
}

/**
 * GET /api/weather?lat=&lon= — public endpoint, no JWT required.
 * Returns current weather from the backend's OpenWeather integration.
 */
export async function fetchWeather(lat: number, lon: number): Promise<BackendWeather> {
  const res = await client.get<BackendWeather>('/api/weather', { params: { lat, lon } });
  return res.data;
}

/**
 * GET /api/weather/forecast?lat=&lon= — public endpoint, no JWT required.
 * Returns up to 7-day forecast from the backend.
 */
export async function fetchForecast(lat: number, lon: number): Promise<ForecastResponse> {
  const res = await client.get<ForecastResponse>('/api/weather/forecast', { params: { lat, lon } });
  return res.data;
}
