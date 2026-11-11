const express = require("express");
const db = require("../db/postgresClient");
const cache = require("../cache/memoryCache");
const { getSeasons } = require("../services/seasonService");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * GET /api/seasons
 * Returns the current season (latest stored) and all stored seasons, newest first
 */
router.get("/seasons", async (req, res) => {
  try {
    const { current, available } = await getSeasons(db, cache);
    res.json({ success: true, current, available });
  } catch (error) {
    logger.error("[API] /seasons - Error:", {
      message: error.message,
      stack: error.stack,
      requestId: req.id,
    });
    res.status(500).json({ success: false, message: "Failed to fetch seasons" });
  }
});

module.exports = router;
