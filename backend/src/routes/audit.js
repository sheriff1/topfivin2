const express = require("express");
const db = require("../db/postgresClient");
const { getAuditGames, getGameStats } = require("../services/auditService");
const { validateAuditGames, validateGameStats } = require("../middleware/validationSchemas");
const { validationMiddleware } = require("../middleware/validation");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * GET /api/audit/games
 * Returns game collection audit data
 * Query params: ?season=2025&status=collected|missing&date=2026-03-12&limit=100&offset=0
 */
router.get("/audit/games", validateAuditGames, validationMiddleware, async (req, res) => {
  try {
    const season = req.query.season || process.env.CURRENT_SEASON || "2025";
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status;
    const date = req.query.date;

    const result = await getAuditGames(season, limit, offset, status, date, db);

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error("[API] /audit/games - Error:", {
      message: error.message,
      stack: error.stack,
      requestId: req.id,
    });
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit data",
    });
  }
});

/**
 * GET /api/audit/game/:gameId/stats
 * Returns aggregated team stats for a specific game
 */
router.get(
  "/audit/game/:gameId/stats",
  validateGameStats,
  validationMiddleware,
  async (req, res) => {
    try {
      const gameId = req.params.gameId;

      if (!gameId || gameId.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid game ID",
        });
      }

      const stats = await getGameStats(gameId, db);

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error("[API] /audit/game/:gameId/stats - Error:", {
        message: error.message,
        stack: error.stack,
        gameId: req.params.gameId,
        requestId: req.id,
      });
      res.status(500).json({
        success: false,
        message: "Failed to fetch game stats",
      });
    }
  }
);

module.exports = router;
