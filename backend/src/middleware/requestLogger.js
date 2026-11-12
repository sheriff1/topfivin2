const logger = require("../utils/logger");

// Diagnostic for verifying `trust proxy` behind a host (see #203): when LOG_CLIENT_IP=true,
// each request line also carries req.ip and the raw X-Forwarded-For chain. Off by default
// so client IPs are not written to logs routinely.
const LOG_CLIENT_IP = process.env.LOG_CLIENT_IP === "true";

/**
 * Logs one structured line per HTTP request after the response is sent.
 * Uses the res.on('finish') event so the status code and latency are known.
 *
 * Skips GET /health to avoid log noise from uptime probes.
 *
 * Example log entry:
 *   { level: "info", message: "HTTP request", method: "GET", path: "/api/teams",
 *     statusCode: 200, duration: 12, requestId: "uuid", service: "topfivin2-api" }
 */
function requestLogger(req, res, next) {
  if (req.method === "GET" && req.path === "/health") {
    return next();
  }

  const start = Date.now();

  res.on("finish", () => {
    logger.info("HTTP request", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Date.now() - start,
      requestId: req.id,
      ...(LOG_CLIENT_IP && { ip: req.ip, forwardedFor: req.headers["x-forwarded-for"] }),
    });
  });

  next();
}

module.exports = requestLogger;
