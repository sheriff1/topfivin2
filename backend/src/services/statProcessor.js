const logger = require("../utils/logger");

/**
 * Advanced NBA stats categories with their column indices
 * These correspond to the headers returned by the leaguedashteamstats endpoint
 */
const STAT_CATEGORIES = {
  // Traditional Stats (Available from BoxScoreTraditionalV3)
  "FG%": { label: "Field Goal %", index: "FG_PCT", lower: false },
  "3P%": { label: "3-Point %", index: "3P_PCT", lower: false },
  "FT%": { label: "Free Throw %", index: "FT_PCT", lower: false },
  PPG: { label: "Points Per Game", index: "PTS", lower: false },
  RPG: { label: "Rebounds Per Game", index: "REB", lower: false },
  APG: { label: "Assists Per Game", index: "AST", lower: false },
  SPG: { label: "Steals Per Game", index: "STL", lower: false },
  BPG: { label: "Blocks Per Game", index: "BLK", lower: false },

  // Advanced Stats (Available from BoxScoreMiscV3)
  "TS%": { label: "True Shooting %", index: "TS_PCT", lower: false },
  "ORB%": { label: "Offensive Rebound %", index: "ORB_PCT", lower: false },
  "DRB%": { label: "Defensive Rebound %", index: "DRB_PCT", lower: false },
  "TRB%": { label: "Total Rebound %", index: "TRB_PCT", lower: false },
  "AST%": { label: "Assist %", index: "AST_PCT", lower: false },
  "USG%": { label: "Usage %", index: "USG_PCT", lower: false },
  "TOV%": { label: "Turnover %", index: "TOV_PCT", lower: true },

  // V3 Rating Stats (BoxScoreAdvancedV3)
  ORTG: { label: "Offensive Rating", index: "ORTG", lower: false },
  DRTG: { label: "Defensive Rating", index: "DRTG", lower: true },
  NET_RTG: { label: "Net Rating", index: "NET_RTG", lower: false },
  "EFG%": { label: "Effective FG %", index: "EFG_PCT", lower: false },
  PACE: { label: "Pace", index: "PACE", lower: false },

  // Scoring Breakdown (BoxScoreMiscV3)
  PTS_PAINT: { label: "Points in Paint", index: "PTS_PAINT", lower: false },
  OPP_PAINT: { label: "Opp Points in Paint", index: "OPP_PAINT", lower: true },
  FAST_BRK: { label: "Fast Break Points", index: "FAST_BRK", lower: false },
  OPP_FBRK: { label: "Opp Fast Break Pts", index: "OPP_FBRK", lower: true },

  // Hustle Stats (BoxScoreHustleV2)
  DEFLECT: { label: "Deflections", index: "DEFLECT", lower: false },
  CONTESTED: { label: "Contested Shots", index: "CONTESTED", lower: false },
  SCR_AST: { label: "Screen Assists", index: "SCR_AST", lower: false },
  CONTESTED_2PT: { label: "Contested 2PT Shots", index: "CONTESTED_2PT", lower: false },
  CONTESTED_3PT: { label: "Contested 3PT Shots", index: "CONTESTED_3PT", lower: false },
  CHARGES: { label: "Charges Drawn", index: "CHARGES", lower: false },
  BOX_OUTS: { label: "Box Outs", index: "BOX_OUTS", lower: false },

  // Misc new extras (BoxScoreMiscV3)
  OPP_PTS_OFF_TO: { label: "Opp Pts Off Turnovers", index: "OPP_PTS_OFF_TO", lower: true },
  OPP_2ND_CHC: { label: "Opp 2nd Chance Pts", index: "OPP_2ND_CHC", lower: true },
  BLK_AGT: { label: "Blocks Against", index: "BLK_AGT", lower: true },
  FOULS_DRAWN: { label: "Fouls Drawn", index: "FOULS_DRAWN", lower: false },

  // Advanced new extras (BoxScoreAdvancedV3)
  AST_TOV: { label: "Assist-to-Turnover Ratio", index: "AST_TOV", lower: false },
  PACE40: { label: "Pace Per 40", index: "PACE40", lower: false },
  BOX_OUT_TREB: { label: "Box Out Team Rebounds", index: "BOX_OUT_TREB", lower: false },
  BOX_OUT_PREB: { label: "Box Out Player Rebounds", index: "BOX_OUT_PREB", lower: false },

  // Traditional per-game averages
  ORPG: { label: "Offensive Rebounds Per Game", index: "ORPG", lower: false },
  DRPG: { label: "Defensive Rebounds Per Game", index: "DRPG", lower: false },
  TPG: { label: "Turnovers Per Game", index: "TPG", lower: true },
  PFPG: { label: "Personal Fouls Per Game", index: "PFPG", lower: true },
  PM: { label: "Plus/Minus Per Game", index: "PM", lower: false },
  FG_PG: { label: "Field Goals Made Per Game", index: "FG_PG", lower: false },
  FGA_PG: { label: "Field Goal Attempts Per Game", index: "FGA_PG", lower: false },
  THREE_PG: { label: "3-Pointers Made Per Game", index: "THREE_PG", lower: false },

  // BoxScoreAdvancedV3 extras
  POSS: { label: "Possessions Per Game", index: "POSS", lower: false },
  PIE: { label: "Player Impact Estimate", index: "PIE", lower: false },
  AST_RATIO: { label: "Assist Ratio", index: "AST_RATIO", lower: false },
  TOV_RATIO: { label: "Turnover Ratio", index: "TOV_RATIO", lower: true },

  // BoxScoreSummaryV3 extras
  BIG_LEAD: { label: "Biggest Lead (avg)", index: "BIG_LEAD", lower: false },
  BENCH_PTS: { label: "Bench Points Per Game", index: "BENCH_PTS", lower: false },
  LEAD_CHG: { label: "Lead Changes Per Game", index: "LEAD_CHG", lower: false },
  TIMES_TIED: { label: "Times Tied Per Game", index: "TIMES_TIED", lower: false },
  BIG_RUN: { label: "Biggest Scoring Run (avg)", index: "BIG_RUN", lower: false },
  TOV_TEAM: { label: "Team Turnovers Per Game", index: "TOV_TEAM", lower: true },
  TOV_TOTAL: { label: "Total Turnovers Per Game", index: "TOV_TOTAL", lower: true },
  REB_TEAM: { label: "Team Rebounds Per Game", index: "REB_TEAM", lower: false },

  // BoxScoreMiscV3 extras
  PTS_2ND_CHC: { label: "2nd Chance Points Per Game", index: "PTS_2ND_CHC", lower: false },
  PTS_OFF_TO: { label: "Points Off Turnovers Per Game", index: "PTS_OFF_TO", lower: false },

  // BoxScoreHustleV2 extras
  SCR_AST_PTS: { label: "Screen Assist Points Per Game", index: "SCR_AST_PTS", lower: false },
  LOOSE_BALLS: { label: "Loose Balls Recovered Per Game", index: "LOOSE_BALLS", lower: false },
  LOOSE_BALLS_O: {
    label: "Off. Loose Balls Recovered Per Game",
    index: "LOOSE_BALLS_O",
    lower: false,
  },
  LOOSE_BALLS_D: {
    label: "Def. Loose Balls Recovered Per Game",
    index: "LOOSE_BALLS_D",
    lower: false,
  },
  BOX_OUTS_O: { label: "Offensive Box Outs Per Game", index: "BOX_OUTS_O", lower: false },
  BOX_OUTS_D: { label: "Defensive Box Outs Per Game", index: "BOX_OUTS_D", lower: false },

  // Starters group stats (BoxScoreTraditionalV3 DF1)
  STARTERS_PPG: { label: "Starter Points Per Game", index: "STARTERS_PPG", lower: false },
  STARTERS_RPG: { label: "Starter Rebounds Per Game", index: "STARTERS_RPG", lower: false },
  STARTERS_APG: { label: "Starter Assists Per Game", index: "STARTERS_APG", lower: false },
  STARTERS_SPG: { label: "Starter Steals Per Game", index: "STARTERS_SPG", lower: false },
  STARTERS_BPG: { label: "Starter Blocks Per Game", index: "STARTERS_BPG", lower: false },
  "STARTERS_FG%": { label: "Starter Field Goal %", index: "STARTERS_FG%", lower: false },
  "STARTERS_3P%": { label: "Starter 3-Point %", index: "STARTERS_3P%", lower: false },
  "STARTERS_FT%": { label: "Starter Free Throw %", index: "STARTERS_FT%", lower: false },
  STARTERS_FG: { label: "Starter FG Made Per Game", index: "STARTERS_FG", lower: false },
  STARTERS_FGA: { label: "Starter FGA Per Game", index: "STARTERS_FGA", lower: false },
  STARTERS_3P: { label: "Starter 3P Made Per Game", index: "STARTERS_3P", lower: false },
  STARTERS_3PA: { label: "Starter 3PA Per Game", index: "STARTERS_3PA", lower: false },
  STARTERS_OREB: { label: "Starter Off. Rebounds Per Game", index: "STARTERS_OREB", lower: false },
  STARTERS_DREB: { label: "Starter Def. Rebounds Per Game", index: "STARTERS_DREB", lower: false },
  STARTERS_FT: { label: "Starter FT Made Per Game", index: "STARTERS_FT", lower: false },
  STARTERS_FTA: { label: "Starter FTA Per Game", index: "STARTERS_FTA", lower: false },
  STARTERS_TOV: { label: "Starter Turnovers Per Game", index: "STARTERS_TOV", lower: true },
  STARTERS_PF: { label: "Starter Fouls Per Game", index: "STARTERS_PF", lower: true },
  STARTERS_PM: { label: "Starter Plus/Minus Per Game", index: "STARTERS_PM", lower: false },

  // Bench group stats (BoxScoreTraditionalV3 DF1)
  BENCH_PPG: { label: "Bench Points Per Game", index: "BENCH_PPG", lower: false },
  BENCH_RPG: { label: "Bench Rebounds Per Game", index: "BENCH_RPG", lower: false },
  BENCH_APG: { label: "Bench Assists Per Game", index: "BENCH_APG", lower: false },
  BENCH_SPG: { label: "Bench Steals Per Game", index: "BENCH_SPG", lower: false },
  BENCH_BPG: { label: "Bench Blocks Per Game", index: "BENCH_BPG", lower: false },
  "BENCH_FG%": { label: "Bench Field Goal %", index: "BENCH_FG%", lower: false },
  "BENCH_3P%": { label: "Bench 3-Point %", index: "BENCH_3P%", lower: false },
  "BENCH_FT%": { label: "Bench Free Throw %", index: "BENCH_FT%", lower: false },
  BENCH_FG: { label: "Bench FG Made Per Game", index: "BENCH_FG", lower: false },
  BENCH_FGA: { label: "Bench FGA Per Game", index: "BENCH_FGA", lower: false },
  BENCH_3P: { label: "Bench 3P Made Per Game", index: "BENCH_3P", lower: false },
  BENCH_3PA: { label: "Bench 3PA Per Game", index: "BENCH_3PA", lower: false },
  BENCH_OREB: { label: "Bench Off. Rebounds Per Game", index: "BENCH_OREB", lower: false },
  BENCH_DREB: { label: "Bench Def. Rebounds Per Game", index: "BENCH_DREB", lower: false },
  BENCH_FT: { label: "Bench FT Made Per Game", index: "BENCH_FT", lower: false },
  BENCH_FTA: { label: "Bench FTA Per Game", index: "BENCH_FTA", lower: false },
  BENCH_TOV: { label: "Bench Turnovers Per Game", index: "BENCH_TOV", lower: true },
  BENCH_PF: { label: "Bench Fouls Per Game", index: "BENCH_PF", lower: true },
  BENCH_PM: { label: "Bench Plus/Minus Per Game", index: "BENCH_PM", lower: false },

  // Game context stats (BoxScoreSummaryV3 DF0 + DF4)
  ATTEND: { label: "Avg Attendance", index: "ATTEND", lower: false },
  DURATION: { label: "Avg Game Duration (mins)", index: "DURATION", lower: false },
  Q1_PTS: { label: "Q1 Points Per Game", index: "Q1_PTS", lower: false },
  Q2_PTS: { label: "Q2 Points Per Game", index: "Q2_PTS", lower: false },
  Q3_PTS: { label: "Q3 Points Per Game", index: "Q3_PTS", lower: false },
  Q4_PTS: { label: "Q4 Points Per Game", index: "Q4_PTS", lower: false },

  // Estimated advanced ratings (BoxScoreAdvancedV3 DF1, migration 008)
  E_ORTG: { label: "Estimated Off. Rating", index: "E_ORTG", lower: false },
  E_DRTG: { label: "Estimated Def. Rating", index: "E_DRTG", lower: true },
  E_NET_RTG: { label: "Estimated Net Rating", index: "E_NET_RTG", lower: false },
  E_PACE: { label: "Estimated Pace", index: "E_PACE", lower: false },
};

/**
 * Create a mapping object from headers array
 * @param {array} headers - Array of column headers/names
 * @returns {object} - Mapping of column name to index
 */
function createHeaderMap(headers) {
  const map = {};
  headers.forEach((header, index) => {
    map[header.toUpperCase()] = index;
  });
  return map;
}

/**
 * Extract team data and organize stats
 * @param {object|array} teamStatsData - Raw team stats from API or array directly
 * @returns {array} - Normalized team stats array
 */
function normalizeTeamStats(teamStatsData) {
  // Handle direct array input (from mock data) vs wrapped format
  const data = Array.isArray(teamStatsData) ? teamStatsData : teamStatsData.data || [];
  const headers = teamStatsData.headers || [];

  const normalizedData = data.map((row) => {
    let teamId, teamName, statsObj;

    if (Array.isArray(row)) {
      // Old NBA.com format - row is an array
      const headerMap = createHeaderMap(headers);
      teamId = row[headerMap["TEAM_ID"]];
      teamName = row[headerMap["TEAM_NAME"]];
      statsObj = {};

      Object.entries(STAT_CATEGORIES).forEach(([key, config]) => {
        const colIndex = headerMap[config.index.toUpperCase()];
        if (colIndex !== undefined) {
          statsObj[key] = parseFloat(row[colIndex]) || 0;
        }
      });
    } else {
      // Object format (mock data or RapidAPI) - row is already an object
      // The mock data already has all the required stat fields with short keys
      teamId = row.id || row.teamId || row.team_id;
      teamName = row.name || row.teamName || row.team_name;

      statsObj = {
        PPG: parseFloat(row.PPG || row.pts || row.pointsPerGame || 0),
        RPG: parseFloat(row.RPG || row.reb || row.reboundsPerGame || row.rebounds || 0),
        APG: parseFloat(row.APG || row.ast || row.assistsPerGame || row.assists || 0),
        "FG%": parseFloat(row["FG%"] || row.fgPercent || row.fg_pct || row.fieldGoalPct || 0),
        "3P%": parseFloat(
          row["3P%"] || row.threePPercent || row.threeP_pct || row.threePointerPct || 0
        ),
        "FT%": parseFloat(row["FT%"] || row.ftPercent || row.ft_pct || row.freeThrowPct || 0),
        SPG: parseFloat(row.SPG || row.stl || row.stealsPerGame || row.steals || 0),
        BPG: parseFloat(row.BPG || row.blk || row.blocksPerGame || row.blocks || 0),
      };
    }

    return {
      team_id: teamId,
      team_name: teamName,
      stats: statsObj,
    };
  });

  return normalizedData;
}

/**
 * Calculate rankings for a specific stat category
 * @param {array} teamStats - Normalized team stats array
 * @param {string} statCategory - Stat category key (e.g., 'PPG')
 * @returns {array} - Sorted rankings with team info and rank
 */
function calculateRankings(teamStats, statCategory) {
  const config = STAT_CATEGORIES[statCategory];
  if (!config) {
    throw new Error(`Unknown stat category: ${statCategory}`);
  }

  // Extract stat values and sort
  const rankings = teamStats
    .map((team) => ({
      team_id: team.team_id,
      team_name: team.team_name,
      stat_category: statCategory,
      stat_label: config.label,
      value: team.stats[statCategory] || 0,
    }))
    .sort((a, b) => {
      // Sort descending by default (higher is better)
      // For stats where lower is better, reverse the sort
      if (config.lower) {
        return a.value - b.value;
      } else {
        return b.value - a.value;
      }
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return rankings;
}

/**
 * Calculate all stat rankings
 * @param {array} teamStats - Normalized team stats array
 * @returns {object} - Object with rankings for each stat category
 */
function calculateAllRankings(teamStats) {
  const allRankings = {};

  Object.keys(STAT_CATEGORIES).forEach((category) => {
    try {
      allRankings[category] = calculateRankings(teamStats, category);
    } catch (error) {
      logger.warn(`Failed to calculate rankings for ${category}:`, { message: error.message });
    }
  });

  return allRankings;
}

/**
 * Process raw NBA API data and generate rankings
 * @param {object} teamStatsData - Raw data from fetchTeamStats()
 * @returns {object} - Processed rankings and normalized stats
 */
function processTeamStats(teamStatsData) {
  logger.debug("Processing team stats...");

  // Normalize the raw data
  const normalizedStats = normalizeTeamStats(teamStatsData);

  // Calculate rankings for all categories
  const rankings = calculateAllRankings(normalizedStats);

  logger.info(`Generated rankings for ${Object.keys(rankings).length} stat categories`);

  return {
    normalized_stats: normalizedStats,
    rankings,
    processed_at: new Date().toISOString(),
  };
}

module.exports = {
  STAT_CATEGORIES,
  normalizeTeamStats,
  calculateRankings,
  calculateAllRankings,
  processTeamStats,
};
