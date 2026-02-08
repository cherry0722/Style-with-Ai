// backend/routes/agent.js
const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');
const Wardrobe = require('../models/wardrobe');
const { scoreOutfit } = require('../services/reasoning/scoreOutfit');
const { normalizeOccasion } = require('../services/reasoning/occasionRules');
const { getWeatherSummary } = require('../services/weatherService');

const router = express.Router();

// Base URL for the Python AI service
// Example: http://127.0.0.1:5002
const AI_SERVICE_URL =
  (process.env.AI_SERVICE_URL || 'http://127.0.0.1:5002').replace(/\/$/, '');

// --- Phase 3A: Reasoned outfits (metadata-only, no image processing) ---
// Phase 3B: occasion normalization, optional weather enrichment, contextUsed, diversity filter
router.post('/reasoned_outfits', auth, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid auth payload' });
    }

    let { occasion, location, weather } = req.body || {};
    const loc = location && typeof location === 'object' ? location : {};
    let weatherUsed = false;
    let tempFUsed = null;

    // Phase 3B.1: Normalize location - accept { latitude, longitude } OR { lat, lon } or { lat, lng }
    const lat = loc.latitude != null ? Number(loc.latitude) : (loc.lat != null ? Number(loc.lat) : NaN);
    const lon = loc.longitude != null ? Number(loc.longitude) : (loc.lon != null ? Number(loc.lon) : (loc.lng != null ? Number(loc.lng) : NaN));
    const hasLatLon = Number.isFinite(lat) && Number.isFinite(lon);
    const locationUsed = Boolean(loc && (hasLatLon || loc.city != null || loc.region != null));

    // Phase 3B: Optional weather enrichment (only if lat/lon provided and WEATHER_API_KEY set)
    if (!weather || typeof weather !== 'object') {
      weather = {};
    }
    const hasWeatherKey = Boolean((process.env.WEATHER_API_KEY || '').trim() && process.env.WEATHER_API_KEY !== 'demo_key');
    const requestWeatherPresent = weather.tempF != null || (weather.condition != null && String(weather.condition).trim() !== '');
    const requestWeatherMissing = !requestWeatherPresent;

    // Phase 3B.2: Dev-only logs for weather enrichment debugging (never log the key)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[WEATHER] keyPresent=' + hasWeatherKey);
      console.log('[WEATHER] lat=' + lat + ' lon=' + lon);
      console.log('[WEATHER] requestWeatherPresent=' + requestWeatherPresent);
    }

    if (requestWeatherMissing && hasLatLon && hasWeatherKey) {
      try {
        const w = await getWeatherSummary(lat, lon);
        if (w && !w.error) {
          weather = { ...weather, tempF: w.tempF, condition: w.summary };
          weatherUsed = true;
          tempFUsed = w.tempF;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[WEATHER] fetched tempF=' + tempFUsed + ' condition=' + (w.summary || ''));
          }
        } else if (w && w.error && process.env.NODE_ENV !== 'production') {
          console.log('[WEATHER] skip: ' + w.error);
        }
      } catch (e) {
        const errMsg = (e && e.message) || String(e);
        console.log('[WEATHER] failed: ' + errMsg);
        // Do not crash; continue without weather
      }
    } else if (requestWeatherPresent && weather.tempF != null) {
      weatherUsed = true;
      tempFUsed = Number(weather.tempF);
    } else if (process.env.NODE_ENV !== 'production' && requestWeatherMissing) {
      if (!hasWeatherKey || !hasLatLon) {
        console.log('[WEATHER] skip: missing key/latlon');
      }
    }

    const normalizedOccasion = normalizeOccasion(occasion);
    const hasOccasion = occasion != null && String(occasion).trim();
    const context = {
      occasion: hasOccasion ? normalizedOccasion : undefined,
      location: loc,
      weather,
    };

    let pythonErrorForFallback = null;

    const items = await Wardrobe.find({ userId }).lean().exec();

    // Phase 3D: response metadata: engine ("python" | "fallback"), pythonUsed, pythonError (short string or null)
    const contextUsed = {
      occasion: normalizedOccasion,
      weatherUsed,
      tempF: tempFUsed,
      locationUsed,
    };

    // Guardrail: empty wardrobe
    if (!items || items.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[REASONED_OUTFITS] engine=fallback (empty wardrobe)');
      }
      return res.status(200).json({
        message: 'Your wardrobe is empty. Add some items to get outfit recommendations.',
        outfits: [],
        contextUsed,
        engine: 'fallback',
        pythonUsed: false,
        pythonError: null,
      });
    }

    // Phase 3C: Python-first when >= 3 usable items (with profile); else Node scoreOutfit fallback
    const usableItems = items.filter((i) => i && (i.profile != null && typeof i.profile === 'object'));
    const idToItem = new Map(items.map((i) => [String(i._id), i]));

    if (usableItems.length >= 3) {
      const payload = {
        occasion: hasOccasion ? normalizedOccasion : undefined,
        location: Object.keys(loc).length ? loc : null,
        weather: (weather.tempF != null || (weather.condition && String(weather.condition).trim())) ? weather : null,
        items: usableItems.map((i) => ({
          id: String(i._id),
          profile: i.profile,
        })),
      };
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.INTERNAL_TOKEN) headers['X-Internal-Token'] = process.env.INTERNAL_TOKEN;
      try {
        const pyRes = await axios.post(
          AI_SERVICE_URL + '/generate-outfits',
          payload,
          { headers, timeout: 15000 }
        );
        const data = pyRes.data || {};
        const pyOutfits = Array.isArray(data.outfits) ? data.outfits : [];
        if (pyRes.status >= 200 && pyRes.status < 300 && pyOutfits.length > 0) {
          const outfitsPayload = pyOutfits.slice(0, 3).map((o) => {
            const itemIds = Array.isArray(o.itemIds) ? o.itemIds : [];
            const fullItems = itemIds.map((id) => idToItem.get(String(id))).filter(Boolean);
            const why = typeof o.why === 'string' ? o.why : '';
            const notes = Array.isArray(o.notes) ? o.notes : [];
            const reasons = [why, ...notes].filter(Boolean);
            const entry = { items: fullItems, reasons };
            if (fullItems.length === 0) return null;
            return entry;
          }).filter(Boolean);
          if (outfitsPayload.length > 0) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('[REASONED_OUTFITS] engine=python pythonUsed=true');
            }
            return res.status(200).json({
              outfits: outfitsPayload,
              contextUsed,
              engine: 'python',
              pythonUsed: true,
              pythonError: null,
            });
          }
        }
        // Non-2xx or empty/bad schema: treat as failure, use fallback
        const errMsg = pyRes.status >= 200 && pyRes.status < 300
          ? 'Invalid or empty outfits in response'
          : 'Python returned ' + (pyRes.status || 'non-2xx');
        if (process.env.NODE_ENV !== 'production') {
          console.log('[REASONED_OUTFITS] engine=fallback pythonError=' + errMsg);
        }
        throw new Error(errMsg);
      } catch (pyErr) {
        const shortError = (pyErr.code && String(pyErr.code).length < 50)
          ? pyErr.code
          : (pyErr.response && pyErr.response.status)
            ? 'HTTP ' + pyErr.response.status
            : (pyErr.message && String(pyErr.message).length <= 120)
              ? String(pyErr.message)
              : (pyErr.message ? String(pyErr.message).slice(0, 120) : 'Python request failed');
        if (process.env.NODE_ENV !== 'production') {
          console.log('[REASONED_OUTFITS] engine=fallback pythonError=' + shortError);
        }
        pythonErrorForFallback = shortError;
      }
    }

    // Fallback: Node scoreOutfit (Phase 3A/3B)
    const { outfits } = scoreOutfit({ items, context });

    // Phase 3B: Diversity filter - dedupe by outfit signature (sorted item IDs joined by "-")
    const seen = new Set();
    const unique = outfits.filter((o) => {
      const sig = o.items.map((i) => String(i._id || i.id || '')).sort().join('-');
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    const top3 = unique.slice(0, 3);

    if (process.env.NODE_ENV !== 'production') {
      const usedPythonAttempt = usableItems.length >= 3;
      console.log('[REASONED_OUTFITS] engine=fallback pythonUsed=' + (usedPythonAttempt ? 'false (attempted)' : 'false'));
    }

    const fallbackPayload = {
      outfits: top3.map((o) => {
        const entry = { items: o.items, score: o.score, reasons: o.reasons };
        if (o.missing && o.missing.length > 0) entry.missing = o.missing;
        return entry;
      }),
      contextUsed,
      engine: 'fallback',
      pythonUsed: false,
      pythonError: pythonErrorForFallback,
    };
    return res.status(200).json(fallbackPayload);
  } catch (err) {
    console.error('[AgentRoute] reasoned_outfits error:', err);
    return res.status(500).json({
      message: 'Failed to compute reasoned outfits',
      detail: err.message,
    });
  }
});

router.post('/suggest_outfit', async (req, res) => {
  const targetUrl = `${AI_SERVICE_URL}/suggest_outfit`;

  console.log('[AgentRoute] Forwarding request to AI service:', targetUrl);
  console.log('[AgentRoute] Request body:', req.body);
  
  // Log preferences presence (Phase 5A)
  const hasPreferences = req.body && req.body.preferences;
  console.log('[AgentRoute] Preferences present:', hasPreferences ? 'yes' : 'no');

  try {
    const response = await axios.post(targetUrl, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    console.log('[AgentRoute] AI service response status:', response.status);
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error('[AgentRoute] Error calling AI service:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });

    res.status(502).json({
      message: 'Failed to reach AI outfit service',
      detail: err.response?.data || err.message,
    });
  }
});

module.exports = router;

