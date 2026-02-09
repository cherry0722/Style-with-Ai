/**
 * Centralized error handler. Returns safe JSON only: { error: { code, message, requestId } }.
 * Never exposes stack traces. Uses status from err.status/statusCode or 500.
 */
function errorHandler(err, req, res, next) {
  const requestId = req.requestId || req.id || 'unknown';
  let status = err.status ?? err.statusCode ?? 500;
  if (err.code === 'LIMIT_FILE_SIZE' || (err.message && /file size|too large/i.test(err.message))) {
    status = 413;
  }
  if (err.message && /unsupported file type|only jpeg|mime/i.test(err.message)) {
    status = 415;
  }
  const code = err.code && typeof err.code === 'string' && err.code !== 'LIMIT_FILE_SIZE'
    ? err.code
    : (status === 413 ? 'FILE_TOO_LARGE' : status === 415 ? 'UNSUPPORTED_MEDIA' : status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  const message = err.message && typeof err.message === 'string'
    ? err.message
    : 'An error occurred';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${requestId}]`, err.message || err);
    if (err.stack) console.error(err.stack);
  }

  res.status(status).json({
    error: {
      code,
      message,
      requestId,
    },
  });
}

module.exports = errorHandler;
