const express = require("express");
const db = require("../db/postgresClient");
const { getTeamStats, getTeamRankings } = require("../services/teamsService");
const { TEAM_ABBR_TO_ID } = require("../utils/teamConstants");
const {
  validateTeams,
  validateTeamByAbbr,
  validateTeamStats,
  validateTeamRankings,
} = require("../middleware/validationSchemas");
const { validationMiddleware } = require("../middleware/validation");

const router = express.Router();

/**
 * GET /api/teams
 * Returns team info (name, colors, logo)
 * Query params: ?team_id=1610612738
 */
router.get("/teams", validateTeams, validationMiddleware, async (req, res) => {
  try {
    const { team_id } = req.query;

    let query = "SELECT id, team_id, team_name, logo_url, team_colors FROM teams";
    const params = [];

    if (team_id) {
      query += " WHERE team_id = $1";
      params.push(team_id);
    }

    query += " ORDER BY team_id";

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[API] /teams - Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch teams",
      error: error.message,
    });
  }
});

/**
 * GET /api/teams/abbr/:abbreviation
 * Returns team info by team abbreviation (e.g., BOS, LAL)
 * Used for URL routing with team abbreviations
 */
router.get(
  "/teams/abbr/:abbreviation",
  validateTeamByAbbr,
  validationMiddleware,
  async (req, res) => {
  try {
    const abbr = req.params.abbreviation.toUpperCase();

    // Verify abbreviation is valid
    if (!TEAM_ABBR_TO_ID[abbr]) {
      return res.status(400).json({
        success: false,
        message: `Invalid team abbreviation: ${abbr}`,
      });
    }

    const teamId = TEAM_ABBR_TO_ID[abbr];

    // Query database for team info
    const result = await db.query(
      "SELECT id, team_id, team_name, logo_url, team_colors FROM teams WHERE team_id = $1",
      [teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Team not found for abbreviation: ${abbr}`,
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[API] /teams/abbr/:abbreviation - Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team by abbreviation",
      error: error.message,
    });
  }
});

/**
 * GET /api/team/:teamId/stats
 * Returns all stats for a specific team
 * Query params: ?season=2025
 */
router.get(
  "/team/:teamId/stats",
  validateTeamStats,
  validationMiddleware,
  async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = req.query.season || process.env.CURRENT_SEASON || "2025";

    const data = await getTeamStats(teamId, season, db);

    if (!data) {
      return res.status(404).json({ success: false, message: `No stats found for team ${teamId}` });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("[API] /team/:teamId/stats - Error:", error);
    res.status(500).json({
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
router.get(
  "/team/:teamId/rankings",
  validateTeamRankings,
  validationMiddleware,
  async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = req.query.season || process.env.CURRENT_SEASON || "2025";

    const data = await getTeamRankings(teamId, season, db);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: `No rankings found for team ${teamId}`,
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("[API] /team/:teamId/rankings - Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team rankings",
      error: error.message,
    });
  }
});

module.exports = router;
