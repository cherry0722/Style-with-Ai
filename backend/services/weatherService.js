const axios = require('axios');

const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';

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

module.exports = {
  getWeatherSummary,
};

