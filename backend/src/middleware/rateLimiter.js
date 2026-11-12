const rateLimit = require("express-rate-limit");

const isDev = process.env.NODE_ENV === "development";

/**
 * Counters live in express-rate-limit's default in-memory store: they reset on
 * restart and are not shared between instances, so limits are only accurate on a
 * single instance (see README, "Rate limiting").
 *
 * Standard rate limiter for general API endpoints
 * 200 requests per 15 minutes per IP address
 * Disabled in development to avoid 429s during local browsing
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: "Too many requests from this IP address, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  skip: (req) => isDev || req.path === "/health" || req.path === "/ready",
});

module.exports = {
  apiLimiter,
};
