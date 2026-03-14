const express = require("express");
const db = require("../db/postgresClient");
const { getAuditGames } = require("../services/auditService");

const router = express.Router();

/**
 * GET /api/audit/games
 * Returns game collection audit data
 * Query params: ?season=2025&status=collected|missing&date=2026-03-12&limit=100&offset=0
 */
router.get("/audit/games", async (req, res) => {
  try {
    const season = req.query.season || process.env.CURRENT_SEASON || "2025";
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status;
    const date = req.query.date;

    const result = await getAuditGames(season, limit, offset, status, date, db);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[API] /audit/games - Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch audit data",
        error: error.message,
      });
  }
});

module.exports = router;
