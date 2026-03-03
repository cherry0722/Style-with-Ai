const express = require('express');
const router = express.Router();
const { getWeatherSummary, getForecast7Day } = require('../services/weatherService');

router.get('/', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ message: 'Invalid or missing lat/lon query parameters' });
    }

    const weather = await getWeatherSummary(lat, lon);
    if (weather && weather.error) {
      return res.status(501).json({ message: 'Weather not configured' });
    }
    return res.json(weather);
  } catch (err) {
    console.error('[Weather] Unexpected error:', err);
    return res.status(500).json({ message: 'Failed to fetch weather' });
  }
});

router.get('/forecast', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ message: 'Invalid or missing lat/lon query parameters' });
    }

    const result = await getForecast7Day(lat, lon);
    if (result && result.error) {
      return res.status(501).json({ message: result.error });
    }
    return res.json(result);
  } catch (err) {
    console.error('[Weather] Forecast unexpected error:', err);
    return res.status(500).json({ message: 'Failed to fetch forecast' });
  }
});

module.exports = router;

