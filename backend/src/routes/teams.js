const express = require("express");
const db = require("../db/postgresClient");
const { getTeamStats, getTeamRankings } = require("../services/teamsService");

const router = express.Router();

/**
 * GET /api/team/:teamId/stats
 * Returns all stats for a specific team
 * Query params: ?season=2025
 */
router.get("/team/:teamId/stats", async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = req.query.season || process.env.CURRENT_SEASON || "2025";

    const data = await getTeamStats(teamId, season, db);

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: `No stats found for team ${teamId}` });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("[API] /team/:teamId/stats - Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch team stats",
        error: error.message,
      });
  }
});

/**
 * GET /api/team/:teamId/rankings
 * Returns all rankings for a specific team across all categories
 * Query params: ?season=2025
 */
router.get("/team/:teamId/rankings", async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = req.query.season || process.env.CURRENT_SEASON || "2025";

    const data = await getTeamRankings(teamId, season, db);

    if (!data) {
      return res
        .status(404)
        .json({
          success: false,
          message: `No rankings found for team ${teamId}`,
        });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("[API] /team/:teamId/rankings - Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch team rankings",
        error: error.message,
      });
  }
});

module.exports = router;
