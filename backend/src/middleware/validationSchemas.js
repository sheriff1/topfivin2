const { query, param, validationResult } = require("express-validator");

/**
 * RANKINGS VALIDATION SCHEMAS
 */

// GET /api/categories - No parameters
const validateCategories = [];

// GET /api/rankings
const validateRankings = [
  query("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isString()
    .withMessage("Category must be a string")
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters")
    .matches(/^[A-Za-z0-9_%]+$/)
    .withMessage("Category contains invalid characters"),
  query("season")
    .optional()
    .trim()
    .isString()
    .withMessage("Season must be a string")
    .isLength({ min: 4, max: 4 })
    .withMessage("Season must be 4 digits")
    .isNumeric()
    .withMessage("Season must be numeric"),
];

/**
 * TEAMS VALIDATION SCHEMAS
 */

// GET /api/teams
const validateTeams = [
  query("team_id").optional().isInt({ min: 1 }).withMessage("Team ID must be a positive integer"),
];

// GET /api/teams/abbr/:abbreviation
const validateTeamByAbbr = [
  param("abbreviation")
    .trim()
    .notEmpty()
    .withMessage("Abbreviation is required")
    .isLength({ min: 3, max: 3 })
    .withMessage("Abbreviation must be exactly 3 characters")
    .isAlpha()
    .withMessage("Abbreviation must contain only letters")
    .toUpperCase(),
];

// GET /api/team/:teamId/stats
const validateTeamStats = [
  param("teamId")
    .notEmpty()
    .withMessage("Team ID is required")
    .isInt({ min: 1 })
    .withMessage("Team ID must be a positive integer"),
  query("season")
    .optional()
    .trim()
    .isString()
    .withMessage("Season must be a string")
    .isLength({ min: 4, max: 4 })
    .withMessage("Season must be 4 digits")
    .isNumeric()
    .withMessage("Season must be numeric"),
];

// GET /api/team/:teamId/rankings
const validateTeamRankings = [
  param("teamId")
    .notEmpty()
    .withMessage("Team ID is required")
    .isInt({ min: 1 })
    .withMessage("Team ID must be a positive integer"),
  query("season")
    .optional()
    .trim()
    .isString()
    .withMessage("Season must be a string")
    .isLength({ min: 4, max: 4 })
    .withMessage("Season must be 4 digits")
    .isNumeric()
    .withMessage("Season must be numeric"),
];

/**
 * AUDIT VALIDATION SCHEMAS
 */

// GET /api/audit/games
const validateAuditGames = [
  query("season")
    .optional()
    .trim()
    .isString()
    .withMessage("Season must be a string")
    .isLength({ min: 4, max: 4 })
    .withMessage("Season must be 4 digits")
    .isNumeric()
    .withMessage("Season must be numeric"),
  query("status")
    .optional()
    .trim()
    .isIn(["collected", "missing"])
    .withMessage("Status must be either 'collected' or 'missing'"),
  query("date").optional().trim().isISO8601().withMessage("Date must be in YYYY-MM-DD format"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage("Limit must be between 1 and 500"),
  query("offset").optional().isInt({ min: 0 }).withMessage("Offset must be a non-negative integer"),
];

// GET /api/audit/game/:gameId/stats
const validateGameStats = [
  param("gameId")
    .trim()
    .notEmpty()
    .withMessage("Game ID is required")
    .isLength({ min: 1, max: 50 })
    .withMessage("Game ID must be between 1 and 50 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Game ID contains invalid characters"),
];

module.exports = {
  validateCategories,
  validateRankings,
  validateTeams,
  validateTeamByAbbr,
  validateTeamStats,
  validateTeamRankings,
  validateAuditGames,
  validateGameStats,
};
