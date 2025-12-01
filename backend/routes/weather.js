const express = require('express');
const router = express.Router();
const { getWeatherSummary } = require('../services/weatherService');

router.get('/', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ message: 'Invalid or missing lat/lon query parameters' });
    }

    const weather = await getWeatherSummary(lat, lon);
    return res.json(weather);
  } catch (err) {
    console.error('[Weather] Unexpected error:', err);
    return res.status(500).json({ message: 'Failed to fetch weather' });
  }
});

module.exports = router;

