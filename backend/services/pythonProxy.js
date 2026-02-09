/**
 * Python AI health proxy: 2s hard timeout, safe responses only.
 * Never leak AI_SERVICE_URL or host in responses.
 */
const axios = require('axios');

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:5002').replace(/\/$/, '');
const HEALTH_TIMEOUT_MS = 2000;

const client = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: HEALTH_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Call Python GET /health with 2s timeout.
 * @returns {{ ok: boolean, pythonOk: boolean, latencyMs?: number, message?: string }}
 */
async function healthProxy() {
  const start = Date.now();
  try {
    const res = await client.get('/health');
    const latencyMs = Date.now() - start;
    const data = res.data || {};
    return {
      ok: true,
      pythonOk: Boolean(data.ok),
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PythonProxy] health failed', {
        code: err.code,
        status: err.response?.status,
        latencyMs,
      });
    }
    return {
      ok: true,
      pythonOk: false,
      message: 'AI temporarily unavailable',
      latencyMs,
    };
  }
}

module.exports = { healthProxy };
