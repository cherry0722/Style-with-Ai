/**
 * Home Daily Hub — GET /api/home/today
 * Date: server uses UTC date (YYYY-MM-DD) for "today". Configurable via SERVER_TZ not implemented; consistent UTC.
 * Weather: optional lat/lon query; cached 15 min per rounded lat/lon + date; timeout 3s. Never leaks API key/URL.
 */
const express = require('express');
const auth = require('../middleware/auth');
const CalendarPlan = require('../models/calendarPlan');
const { getWeatherForHome } = require('../services/weatherService');

const router = express.Router();

function getUserId(req) {
  return req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
}

/** Today's date in UTC (YYYY-MM-DD). Consistent across instances; no SERVER_TZ for Phase 2. */
function getTodayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/home/today?lat=...&lon=...
router.get('/today', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }

    const dateStr = getTodayDateStr();
    const lat = req.query.lat;
    const lon = req.query.lon;

    let weather = {
      ok: false,
      tempF: null,
      condition: null,
      source: null,
      cached: false,
      message: null,
    };

    if (lat != null && lon != null) {
      const latNum = parseFloat(lat);
      const lonNum = parseFloat(lon);
      if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
        weather = await getWeatherForHome(latNum, lonNum, dateStr);
      } else {
        weather.message = 'Invalid location';
      }
    } else {
      weather.message = 'Location not provided';
    }

    const entry = await CalendarPlan.findOne({ userId, date: dateStr }).lean().exec();
    const plans = entry?.plans ?? [];

    res.status(200).json({
      date: dateStr,
      weather,
      plans,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
