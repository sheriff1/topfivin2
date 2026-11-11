const db = require("../db/postgresClient");
const cache = require("../cache/memoryCache");
const { getCurrentSeason } = require("../services/seasonService");
const logger = require("../utils/logger");

/**
 * Sets req.season: the explicit ?season= value, otherwise the latest stored season.
 * Responds 404 if no season is requested and the database holds no data yet.
 */
async function resolveSeason(req, res, next) {
  if (req.query.season) {
    req.season = String(req.query.season);
    return next();
  }
  try {
    const current = await getCurrentSeason(db, cache);
    if (!current) {
      return res.status(404).json({ success: false, message: "No season data available" });
    }
    req.season = current;
    next();
  } catch (error) {
    logger.error("[API] resolveSeason - Error:", {
      message: error.message,
      stack: error.stack,
      requestId: req.id,
    });
    res.status(500).json({ success: false, message: "Failed to determine current season" });
  }
}

module.exports = { resolveSeason };
