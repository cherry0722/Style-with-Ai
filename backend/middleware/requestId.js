const { randomUUID } = require('crypto');

/**
 * Attach a unique requestId to each request and expose it for error responses.
 * Use req.requestId in handlers and in the centralized error handler.
 */
function requestIdMiddleware(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = requestIdMiddleware;
