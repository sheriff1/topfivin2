const express = require("express");
const db = require("../db/postgresClient");
const cache = require("../cache/memoryCache");
const { getDataStatus } = require("../services/dataStatusService");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * GET /api/data-status
 * Freshness of the current season's data: { season, latestGameDate, lastFetchedAt }
 * 404 when the database holds no season data yet.
 */
router.get("/data-status", async (req, res) => {
  try {
    const status = await getDataStatus(db, cache);
    if (!status) {
      return res.status(404).json({ success: false, message: "No season data available" });
    }
    res.json({ success: true, ...status });
  } catch (error) {
    logger.error("[API] /data-status - Error:", {
      message: error.message,
      stack: error.stack,
      requestId: req.id,
    });
    res.status(500).json({ success: false, message: "Failed to fetch data status" });
  }
});

module.exports = router;
