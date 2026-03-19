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
};

/**
 * Find index of column in headers array
 * @param {array} headers - Array of column headers
 * @param {string} columnName - Name of column to find
 * @returns {number} - Column index or -1 if not found
 */
function findColumnIndex(headers, columnName) {
  return headers.findIndex((h) => h === columnName || h.toUpperCase() === columnName.toUpperCase());
}

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
