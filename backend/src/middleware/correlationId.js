const { randomUUID } = require("crypto");

/**
 * Assigns a unique request ID to every incoming request.
 * - Sets req.id for use by downstream middleware and route handlers
 * - Echoes the ID back in the X-Request-ID response header so callers
 *   (browser, Sentry, etc.) can correlate client-side and server-side events
 */
function correlationId(req, res, next) {
  req.id = randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
}

module.exports = correlationId;
