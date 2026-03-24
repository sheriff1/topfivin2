const express = require("express");
const db = require("../db/postgresClient");
const cache = require("../cache/redisClient");
const {
  getCategories,
  getRankings,
  getRandomFacts,
  STAT_CATEGORIES,
} = require("../services/rankingsService");
const {
  validateCategories,
  validateRankings,
  validateRandomFacts,
} = require("../middleware/validationSchemas");
const { validationMiddleware } = require("../middleware/validation");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * GET /api/categories
 * Returns list of available stat categories
 */
router.get("/categories", validateCategories, validationMiddleware, (req, res) => {
  try {
    const categories = getCategories();
    res.json({ success: true, categories });
  } catch (error) {
    logger.error("[API] /categories - Error:", {
      message: error.message,
      stack: error.stack,
      requestId: req.id,
    });
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
});

/**
 * GET /api/rankings
 * Returns rankings for a specific stat category
 * Query params: ?category=PPG&season=2025
 */
router.get("/rankings", validateRankings, validationMiddleware, async (req, res) => {
  try {
    const category = req.query.category;
    const season = req.query.season || process.env.CURRENT_SEASON || "2025";

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Missing required query parameter: category",
      });
    }

    if (!STAT_CATEGORIES[category]) {
      return res.status(400).json({
        success: false,
        message: `Invalid stat category: ${category}`,
      });
    }

    const result = await getRankings(category, season, db, cache);

    if (result.rows && result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No rankings found for category: ${category}`,
      });
    }

    res.json({
      success: true,
      rankings: result.rows,
      category,
      label: result.label,
      cached: result.cached,
      ...(result.cached
        ? { cached_at: result.cached_at }
        : { fetched_at: new Date().toISOString() }),
    });
  } catch (error) {
    logger.error("[API] /rankings - Error:", {
      message: error.message,
      stack: error.stack,
      requestId: req.id,
    });
    res.status(500).json({
      success: false,
      message: "Failed to fetch rankings",
    });
  }
});

/**
 * GET /api/rankings/random-facts
 * Returns random top-5 facts for the "Did You Know" carousel
 * Query params: ?count=10&season=2025
 */
router.get(
  "/rankings/random-facts",
  validateRandomFacts,
  validationMiddleware,
  async (req, res) => {
    try {
      const count = parseInt(req.query.count, 10) || 10;
      const season = req.query.season || process.env.CURRENT_SEASON || "2025";

      const facts = await getRandomFacts(count, season, db);

      res.json({
        success: true,
        facts,
      });
    } catch (error) {
      logger.error("[API] /rankings/random-facts - Error:", {
        message: error.message,
        stack: error.stack,
        requestId: req.id,
      });
      res.status(500).json({
        success: false,
        message: "Failed to fetch random facts",
      });
    }
  }
);

module.exports = router;
