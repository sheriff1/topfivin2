const { STAT_CATEGORIES } = require("./statProcessor");

function getCategories() {
  return Object.entries(STAT_CATEGORIES).map(([code, config]) => ({
    code,
    label: config.label,
  }));
}

async function getRankings(category, season, db, cache) {
  const cacheKey = `nba:rankings:${category}:${season}`;
  const cachedData = await cache.get(cacheKey);

  if (cachedData) {
    return {
      rows: cachedData.rankings,
      label: cachedData.label,
      cached: true,
      cached_at: cachedData.cached_at,
    };
  }

  const query = `
    SELECT
      sr.team_id,
      sr.stat_category,
      sr.rank,
      sr.value,
      t.team_name,
      t.logo_url,
      COALESCE(ts.games_played, 0) as games_count
    FROM stat_rankings sr
    LEFT JOIN teams t ON sr.team_id = t.team_id
    LEFT JOIN team_stats ts ON sr.team_id = ts.team_id AND sr.season = ts.season
    WHERE sr.stat_category = $1 AND sr.season = $2
    ORDER BY sr.rank ASC
  `;

  const result = await db.query(query, [category, season]);

  const responseData = {
    rankings: result.rows,
    label: STAT_CATEGORIES[category].label,
    cached_at: new Date().toISOString(),
  };

  await cache.set(cacheKey, responseData, 3600);

  return {
    rows: result.rows,
    label: STAT_CATEGORIES[category].label,
    cached: false,
  };
}

module.exports = { getCategories, getRankings, STAT_CATEGORIES };
