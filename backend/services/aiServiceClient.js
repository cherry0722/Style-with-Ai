/**
 * Shared axios client for the Python AI service (process.env.AI_SERVICE_URL).
 * - Timeout: 180s (3 min) for long-running Vision/LLM ops
 * - HTTP/HTTPS keepAlive agents
 * - Retry: max 2 retries with backoff 2s, 5s for network errors, 502/503/504, timeouts
 * - Logs never print secrets (URLs with tokens, INTERNAL_TOKEN, etc.)
 */
const http = require('http');
const https = require('https');
const axios = require('axios');

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:5002').replace(/\/$/, '');

const TIMEOUT_MS = 180000; // 3 minutes
const RETRY_DELAYS = [2000, 5000]; // 2s, 5s

// KeepAlive agents for connection reuse
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const isHttps = /^https:\/\//i.test(AI_SERVICE_URL);

const client = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: TIMEOUT_MS,
  httpAgent: !isHttps ? httpAgent : undefined,
  httpsAgent: isHttps ? httpsAgent : undefined,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Sleep helper for retry backoff.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if the error is retriable (network error, timeout, 502/503/504).
 */
function isRetriable(err) {
  if (!err) return false;
  const code = err.code;
  const status = err.response?.status;
  if (['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH'].includes(code)) return true;
  if (err.message && /timeout/i.test(err.message)) return true;
  if (status === 502 || status === 503 || status === 504) return true;
  return false;
}

/**
 * Safely log a message without exposing secrets.
 */
function safeLog(prefix, msg, extra = {}) {
  const safe = { ...extra };
  if (safe.url) delete safe.url;
  if (safe.headers && safe.headers['X-Internal-Token']) safe.headers = { 'X-Internal-Token': '[REDACTED]' };
  const suffix = Object.keys(safe).length ? ' ' + JSON.stringify(safe) : '';
  console.log(`[${prefix}] ${msg}${suffix}`);
}

/**
 * Execute a request with retries (max 2 retries, backoff 2s then 5s).
 */
async function requestWithRetry(config) {
  let lastErr;
  const attempts = 1 + RETRY_DELAYS.length;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await client.request(config);
      return res;
    } catch (err) {
      lastErr = err;
      if (!isRetriable(err) || attempt >= RETRY_DELAYS.length) break;
      const delay = RETRY_DELAYS[attempt];
      safeLog('AIService', `Retry ${attempt + 1}/${RETRY_DELAYS.length} after ${delay}ms`, {
        reason: err.code || err.response?.status || err.message?.slice(0, 80),
      });
      await sleep(delay);
    }
  }

  throw lastErr;
}

/**
 * GET /health - used for warmup and health checks.
 */
async function healthCheck() {
  try {
    const res = await requestWithRetry({ method: 'get', url: '/health' });
    return res.data;
  } catch (err) {
    safeLog('AIService', 'Health check failed', {
      status: err.response?.status,
      code: err.code,
      message: (err.message || '').slice(0, 100),
    });
    throw err;
  }
}

/**
 * POST to a path on the AI service with retries.
 * Merges headers (e.g. X-Internal-Token) into config.
 */
async function post(path, data, extraConfig = {}) {
  const headers = { ...(extraConfig.headers || {}) };
  if (process.env.INTERNAL_TOKEN) headers['X-Internal-Token'] = process.env.INTERNAL_TOKEN;

  return requestWithRetry({
    method: 'post',
    url: path,
    data,
    headers,
    ...extraConfig,
  });
}

module.exports = {
  client,
  AI_SERVICE_URL,
  healthCheck,
  post,
  requestWithRetry,
  safeLog,
};
