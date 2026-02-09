const express = require('express');
const auth = require('../middleware/auth');
const Wardrobe = require('../models/wardrobe');
const { normalizeOccasion } = require('../services/reasoning/occasionRules');
const { getWeatherSummary } = require('../services/weatherService');
const aiService = require('../services/aiServiceClient');
const { healthProxy } = require('../services/pythonProxy');
const {
  filterAvailable,
  generateThreeOutfits,
  regenerateOutfit,
  swapCategory,
} = require('../services/fallbackOutfitGenerator');
const { sanitizeWardrobeItem } = require('../utils/sanitizeWardrobeItem');

const router = express.Router();

function getUserId(req) {
  return req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
}

// GET /api/ai/health-proxy — 2s timeout, never leak Python URL/host; safe JSON only
router.get('/health-proxy', async (req, res, next) => {
  try {
    const result = await healthProxy();
    const status = result.pythonOk ? 200 : 200;
    res.status(status).json({
      ok: true,
      pythonOk: result.pythonOk,
      latencyMs: result.latencyMs,
      ...(result.message && { message: result.message }),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/reasoned_outfits — v2: exclude unavailable, lockedItemIds, 3 outfits, same shape for python/node_fallback
router.post('/reasoned_outfits', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }
    const { occasion, context, lockedItemIds } = req.body || {};
    const loc = (context && context.location) || {};
    let weather = (context && context.weather) || {};
    let weatherUsed = false;
    let tempFUsed = null;
    const lat = loc.latitude != null ? Number(loc.latitude) : (loc.lat != null ? Number(loc.lat) : NaN);
    const lon = loc.longitude != null ? Number(loc.longitude) : (loc.lon != null ? Number(loc.lon) : (loc.lng != null ? Number(loc.lng) : NaN));
    const hasLatLon = Number.isFinite(lat) && Number.isFinite(lon);
    const hasWeatherKey = Boolean((process.env.WEATHER_API_KEY || '').trim() && process.env.WEATHER_API_KEY !== 'demo_key');
    if ((!weather || !weather.tempF) && hasLatLon && hasWeatherKey) {
      try {
        const w = await getWeatherSummary(lat, lon);
        if (w && !w.error) {
          weather = { ...weather, tempF: w.tempF, condition: w.summary };
          weatherUsed = true;
          tempFUsed = w.tempF;
        }
      } catch (_) {}
    } else if (weather && weather.tempF != null) {
      weatherUsed = true;
      tempFUsed = Number(weather.tempF);
    }

    const normalizedOccasion = normalizeOccasion(occasion);
    const allItems = await Wardrobe.find({ userId }).lean().exec();
    const availableItems = filterAvailable(allItems);
    const idToItem = new Map(allItems.map((i) => [String(i._id), i]));

    let engine = 'node_fallback';
    let pythonUsed = false;
    let pythonError = null;
    let outfits = [];

    if (availableItems.length === 0) {
      return res.status(200).json({
        engine: 'node_fallback',
        pythonUsed: false,
        pythonError: null,
        outfits: [],
      });
    }

    const locked = Array.isArray(lockedItemIds) ? lockedItemIds.map(String) : [];
    const usableItems = availableItems.filter((i) => i.profile != null && typeof i.profile === 'object');

    if (usableItems.length >= 1) {
      const payload = {
        occasion: normalizedOccasion,
        location: Object.keys(loc).length ? loc : null,
        weather: (weather && (weather.tempF != null || (weather.condition && String(weather.condition).trim()))) ? weather : null,
        items: usableItems.map((i) => ({ id: String(i._id), profile: i.profile })),
        lockedItemIds: locked.length ? locked : undefined,
      };
      try {
        const pyRes = await aiService.post('/generate-outfits', payload);
        const data = pyRes.data || {};
        const pyOutfits = Array.isArray(data.outfits) ? data.outfits : [];
        if (pyRes.status >= 200 && pyRes.status < 300 && pyOutfits.length > 0) {
          const built = pyOutfits.slice(0, 3).map((o) => {
            const itemIds = Array.isArray(o.itemIds) ? o.itemIds : [];
            const fullItems = itemIds.map((id) => idToItem.get(String(id))).filter(Boolean);
            const why = typeof o.why === 'string' ? o.why : '';
            const notes = Array.isArray(o.notes) ? o.notes : [];
            const reasons = [why, ...notes].filter(Boolean);
            const items = fullItems.map(sanitizeWardrobeItem);
            return { outfitId: o.outfitId || require('crypto').randomUUID(), items, lockedItemIds: locked, reasons };
          }).filter((o) => o.items.length > 0);
          if (built.length > 0) {
            engine = 'python';
            pythonUsed = true;
            outfits = built;
          }
        }
        if (outfits.length === 0) {
          pythonError = 'Invalid or empty outfits in response';
        }
      } catch (pyErr) {
        pythonError = pyErr.response?.status ? 'HTTP ' + pyErr.response.status : (pyErr.message || 'Python request failed').slice(0, 120);
      }
    }

    if (outfits.length === 0) {
      const fallback = generateThreeOutfits(availableItems, locked);
      outfits = fallback.map((o) => ({
        outfitId: o.outfitId,
        items: (o.items || []).map(sanitizeWardrobeItem),
        lockedItemIds: o.lockedItemIds,
        reasons: o.reasons,
      }));
    }

    const sanitizedOutfits = outfits.map((o) => ({
      outfitId: o.outfitId,
      items: (o.items || []).map(sanitizeWardrobeItem),
      lockedItemIds: o.lockedItemIds || [],
      reasons: o.reasons || [],
    }));

    res.status(200).json({
      engine,
      pythonUsed,
      pythonError,
      outfits: sanitizedOutfits,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/reasoned_outfits/lock
router.post('/reasoned_outfits/lock', auth, (req, res, next) => {
  try {
    const { outfitId, lockItemIds } = req.body || {};
    const locked = Array.isArray(lockItemIds) ? lockItemIds : [];
    res.status(200).json({ ok: true, outfitId: outfitId || null, lockedItemIds: locked });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/reasoned_outfits/regenerate — body: outfitId, lockedItemIds, items (current outfit)
router.post('/reasoned_outfits/regenerate', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }
    const { outfitId, lockedItemIds, items: currentItems } = req.body || {};
    const allItems = await Wardrobe.find({ userId }).lean().exec();
    const availableItems = filterAvailable(allItems);
    const locked = Array.isArray(lockedItemIds) ? lockedItemIds.map(String) : [];
    const current = Array.isArray(currentItems) ? currentItems : [];
    const result = regenerateOutfit(availableItems, locked, current);
    res.status(200).json({
      outfitId: outfitId || null,
      items: (result.items || []).map(sanitizeWardrobeItem),
      lockedItemIds: result.lockedItemIds,
      changedItemIds: result.changedItemIds || [],
      engine: 'node_fallback',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/reasoned_outfits/swap — deterministic swap by category
router.post('/reasoned_outfits/swap', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }
    const { outfitId, category, items: currentItems } = req.body || {};
    const allItems = await Wardrobe.find({ userId }).lean().exec();
    const availableItems = filterAvailable(allItems);
    const current = Array.isArray(currentItems) ? currentItems : [];
    const result = swapCategory(availableItems, current, category);
    res.status(200).json({
      outfitId: outfitId || null,
      items: (result.items || []).map(sanitizeWardrobeItem),
      engine: 'node_fallback',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/suggest_outfit', async (req, res, next) => {
  const hasPreferences = req.body && req.body.preferences;
  aiService.safeLog('AgentRoute', 'Forwarding suggest_outfit', { preferencesPresent: !!hasPreferences });
  try {
    const response = await aiService.post('/suggest_outfit', req.body);
    res.status(response.status).json(response.data);
  } catch (err) {
    aiService.safeLog('AgentRoute', 'AI service error', {
      status: err.response?.status,
      code: err.code,
      message: (err.message || '').slice(0, 100),
    });
    const e = new Error('AI service temporarily unavailable');
    e.status = 503;
    next(e);
  }
});

module.exports = router;
