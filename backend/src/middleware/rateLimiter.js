const rateLimit = require("express-rate-limit");

const isDev = process.env.NODE_ENV === "development";

/**
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
  skip: (req) => isDev || req.path === "/health",
});

/**
 * Rate limiter for rankings endpoints
 * 150 requests per 15 minutes per IP address
 * Disabled in development
 */
const rankingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150,
  message: "Too many ranking requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});

/**
 * Rate limiter for team stats endpoints
 * 150 requests per 15 minutes per IP address
 * Disabled in development
 */
const teamStatsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150,
  message: "Too many team stats requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});

module.exports = {
  apiLimiter,
  rankingsLimiter,
  teamStatsLimiter,
};
