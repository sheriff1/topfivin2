const express = require("express");
const db = require("../db/postgresClient");
const cache = require("../cache/redisClient");
const { getCategories, getRankings, STAT_CATEGORIES } = require("../services/rankingsService");
const { validateCategories, validateRankings } = require("../middleware/validationSchemas");
const { validationMiddleware } = require("../middleware/validation");

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
    console.error("[API] /categories - Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
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
    console.error("[API] /rankings - Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch rankings",
      error: error.message,
    });
  }
});

module.exports = router;
