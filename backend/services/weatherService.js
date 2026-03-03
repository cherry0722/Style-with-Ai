const axios = require('axios');
const { get: cacheGet, set: cacheSet, cacheKey: buildCacheKey } = require('../utils/weatherCache');

const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_5DAY_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const ONECALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const FORECAST_TIMEOUT_MS = 8000;
const HOME_WEATHER_TIMEOUT_MS = 3000;
const WEATHER_SOURCE_NAME = 'openweathermap';

function getApiKey() {
  return (process.env.WEATHER_API_KEY || '').trim();
}

/**
 * Clamp temperature to realistic bounds for Fahrenheit
 * Ensures temperatures are always between -10°F and 110°F
 */
function clampTemperatureF(raw) {
  if (!Number.isFinite(raw)) return 72;
  // Hard safety bounds
  if (raw < -10) return -10;
  if (raw > 110) return 110;
  return raw;
}

/**
 * Derive precipitation chance from weather data
 */
function derivePrecipChance(data) {
  // If rain or snow is present, high chance
  if (data.rain || data.snow) {
    return 80;
  }

  const summary = data.weather?.[0]?.main || '';
  const summaryLower = summary.toLowerCase();

  // High precipitation conditions
  if (['thunderstorm', 'drizzle', 'rain', 'snow'].includes(summaryLower)) {
    return 60;
  }

  // Cloudy conditions
  if (summaryLower === 'clouds') {
    return 20;
  }

  // Default low chance
  return 5;
}

/**
 * Get weather summary from OpenWeather API
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<{summary: string, tempF: number, precipChance: number}>}
 */
async function getWeatherSummary(lat, lon) {
  // Validate inputs
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
    console.warn('[Weather] Invalid lat/lon provided, using fallback');
    return {
      summary: 'Mild',
      tempF: 72,
      precipChance: 10,
    };
  }

  // Missing or placeholder key: return error object for route to handle (no server crash)
  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'demo_key') {
    return { error: 'Weather not configured' };
  }

  try {
    const url = `${WEATHER_API_URL}?lat=${latNum}&lon=${lonNum}&appid=${apiKey}&units=imperial`;
    
    const response = await axios.get(url, {
      timeout: 10000,
    });

    if (response.status !== 200 || !response.data) {
      throw new Error(`OpenWeather returned status ${response.status}`);
    }

    const data = response.data;

    // Extract summary
    const summary = data.weather?.[0]?.main || 'Mild';

    // Extract and clamp temperature
    const tempF = clampTemperatureF(data.main?.temp);

    // Derive precipitation chance
    const precipChance = derivePrecipChance(data);

    return {
      summary,
      tempF,
      precipChance,
    };
  } catch (err) {
    console.warn('[Weather] Error from OpenWeather:', err.message || err.toString());
    // Return safe fallback
    return {
      summary: 'Mild',
      tempF: 72,
      precipChance: 10,
    };
  }
}

/**
 * Get weather for Home Daily Hub: cached (per rounded lat/lon + date, 15 min), timeout 3s.
 * Never leaks API key or provider URL in response or logs.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} dateStr - YYYY-MM-DD (for cache key)
 * @returns {Promise<{ ok: boolean, tempF: number|null, condition: string|null, source: string|null, cached: boolean, message: string|null }>}
 */
async function getWeatherForHome(lat, lon, dateStr) {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return { ok: false, tempF: null, condition: null, source: null, cached: false, message: 'Invalid location' };
  }

  const key = buildCacheKey(latNum, lonNum, dateStr);
  const cached = cacheGet(key);
  if (cached != null && typeof cached === 'object') {
    return { ...cached, cached: true };
  }

  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'demo_key') {
    return { ok: false, tempF: null, condition: null, source: null, cached: false, message: 'Weather not configured' };
  }

  try {
    const url = `${WEATHER_API_URL}?lat=${latNum}&lon=${lonNum}&appid=${apiKey}&units=imperial`;
    const response = await axios.get(url, { timeout: HOME_WEATHER_TIMEOUT_MS });

    if (response.status !== 200 || !response.data) {
      throw new Error('Bad response');
    }

    const data = response.data;
    const summary = data.weather?.[0]?.main || 'Mild';
    const tempF = clampTemperatureF(data.main?.temp);

    const result = {
      ok: true,
      tempF,
      condition: summary,
      source: WEATHER_SOURCE_NAME,
      cached: false,
      message: null,
    };
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Weather] Home fetch failed (no URL/key logged):', err.code || err.message?.slice(0, 50));
    }
    return {
      ok: false,
      tempF: null,
      condition: null,
      source: null,
      cached: false,
      message: 'Weather temporarily unavailable',
    };
  }
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Try One Call API 3.0 for 8-day daily forecast.
 * Returns null if the key doesn't have access (401/403).
 */
async function tryOneCall(lat, lon, apiKey) {
  try {
    const url = `${ONECALL_URL}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial&exclude=minutely,hourly,alerts,current`;
    const res = await axios.get(url, { timeout: FORECAST_TIMEOUT_MS });
    if (res.status !== 200 || !res.data?.daily) return null;

    return res.data.daily.slice(0, 7).map((d) => {
      const date = new Date(d.dt * 1000);
      const dateISO = date.toISOString().slice(0, 10);
      const dayIdx = date.getDay();
      const isToday = dateISO === new Date().toISOString().slice(0, 10);
      return {
        dateISO,
        label: isToday ? 'Today' : WEEKDAY_LABELS[dayIdx],
        summary: d.weather?.[0]?.main || 'Mild',
        tempHighF: Math.round(clampTemperatureF(d.temp?.max ?? d.temp?.day ?? 72)),
        tempLowF: Math.round(clampTemperatureF(d.temp?.min ?? d.temp?.night ?? 60)),
        precipChance: d.pop != null ? Math.round(d.pop * 100) : null,
      };
    });
  } catch {
    return null;
  }
}

/**
 * Fallback: 5-day / 3-hour forecast, aggregated into daily buckets.
 */
async function tryFiveDayForecast(lat, lon, apiKey) {
  const url = `${FORECAST_5DAY_URL}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
  const res = await axios.get(url, { timeout: FORECAST_TIMEOUT_MS });
  if (res.status !== 200 || !Array.isArray(res.data?.list)) {
    throw new Error('Bad forecast response');
  }

  const buckets = {};
  for (const entry of res.data.list) {
    const dateISO = entry.dt_txt?.slice(0, 10) || new Date(entry.dt * 1000).toISOString().slice(0, 10);
    if (!buckets[dateISO]) {
      buckets[dateISO] = { temps: [], conditions: [], pops: [] };
    }
    buckets[dateISO].temps.push(entry.main?.temp ?? 72);
    buckets[dateISO].conditions.push(entry.weather?.[0]?.main || 'Mild');
    if (entry.pop != null) buckets[dateISO].pops.push(entry.pop);
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const sortedDates = Object.keys(buckets).sort();

  return sortedDates.slice(0, 7).map((dateISO) => {
    const b = buckets[dateISO];
    const date = new Date(dateISO + 'T12:00:00Z');
    const isToday = dateISO === todayISO;

    const mostCommon = b.conditions.sort((a, c) =>
      b.conditions.filter((v) => v === c).length - b.conditions.filter((v) => v === a).length
    ).pop() || 'Mild';

    const maxPop = b.pops.length > 0 ? Math.max(...b.pops) : null;

    return {
      dateISO,
      label: isToday ? 'Today' : WEEKDAY_LABELS[date.getUTCDay()],
      summary: mostCommon,
      tempHighF: Math.round(clampTemperatureF(Math.max(...b.temps))),
      tempLowF: Math.round(clampTemperatureF(Math.min(...b.temps))),
      precipChance: maxPop != null ? Math.round(maxPop * 100) : null,
    };
  });
}

/**
 * Get 7-day forecast. Tries One Call API first, falls back to 5-day/3-hour.
 * Cached per rounded lat/lon, 15 min TTL.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ days: Array }>}
 */
async function getForecast7Day(lat, lon) {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return { error: 'Invalid lat/lon' };
  }

  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'demo_key') {
    return { error: 'Weather not configured' };
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const key = `forecast_${buildCacheKey(latNum, lonNum, todayISO)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    let days = await tryOneCall(latNum, lonNum, apiKey);
    if (!days || days.length === 0) {
      days = await tryFiveDayForecast(latNum, lonNum, apiKey);
    }
    const result = { days: days || [] };
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Weather] Forecast fetch failed:', err.code || err.message?.slice(0, 60));
    }
    return { error: 'Forecast temporarily unavailable' };
  }
}

module.exports = {
  getWeatherSummary,
  getWeatherForHome,
  getForecast7Day,
};

