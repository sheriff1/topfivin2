const rateLimit = require("express-rate-limit");

/**
 * Standard rate limiter for general API endpoints
 * 30 requests per 15 minutes per IP address
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: "Too many requests from this IP address, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === "/health";
  },
});

/**
 * Strict rate limiter for rankings endpoints
 * 15 requests per 15 minutes per IP address (more expensive database queries)
 */
const rankingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 requests per windowMs
  message: "Too many ranking requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Very strict rate limiter for team stats endpoints
 * 20 requests per 15 minutes per IP address
 */
const teamStatsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: "Too many team stats requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  rankingsLimiter,
  teamStatsLimiter,
};
