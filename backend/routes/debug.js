/**
 * GET /api/debug/config — dev-only. In production returns 404 with standard error shape.
 * Proves what the backend sees (Python base configured, health); no secrets.
 */
const express = require('express');
const { healthProxy } = require('../services/pythonProxy');

const router = express.Router();

router.get('/config', async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const requestId = req.requestId || 'unknown';
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Not found', requestId },
    });
  }

  try {
    const pythonBaseConfigured = !!(process.env.AI_SERVICE_URL && String(process.env.AI_SERVICE_URL).trim());
    const aiEnabledServerSide = pythonBaseConfigured;

    const healthResult = await healthProxy();
    const pythonHealth = {
      pythonOk: healthResult.pythonOk,
      latencyMs: healthResult.latencyMs ?? null,
    };

    res.status(200).json({
      ok: true,
      nodeEnv: process.env.NODE_ENV || 'development',
      aiEnabledServerSide,
      pythonBaseConfigured,
      pythonHealth,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
