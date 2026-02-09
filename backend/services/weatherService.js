const axios = require('axios');
const { get: cacheGet, set: cacheSet, cacheKey: buildCacheKey } = require('../utils/weatherCache');

const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';
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

module.exports = {
  getWeatherSummary,
  getWeatherForHome,
};

