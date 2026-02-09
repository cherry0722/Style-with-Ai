/**
 * In-memory cache for weather results. Key = rounded lat/lon + date (YYYY-MM-DD).
 * TTL per entry (default 15 min). Unit-safe: no external deps.
 */
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

const store = new Map();

/**
 * @param {string} key - Cache key (e.g. "32.77_-96.79_2026-02-08")
 * @returns {object|null} Cached value or null if missing/expired
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * @param {string} key - Cache key
 * @param {object} value - Value to cache (must be JSON-serializable shape)
 * @param {number} [ttlMs] - TTL in milliseconds (default 15 min)
 */
function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Build cache key from rounded lat/lon and date (YYYY-MM-DD).
 * @param {number} lat
 * @param {number} lon
 * @param {string} dateStr - YYYY-MM-DD
 */
function cacheKey(lat, lon, dateStr) {
  const rLat = Number.isFinite(lat) ? Math.round(lat * 100) / 100 : 0;
  const rLon = Number.isFinite(lon) ? Math.round(lon * 100) / 100 : 0;
  return `${rLat}_${rLon}_${dateStr}`;
}

module.exports = {
  get,
  set,
  cacheKey,
  DEFAULT_TTL_MS,
};
