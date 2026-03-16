async function getAuditGames(season, limit, offset, status, date, db) {
  let whereConditions = ["g.season = $1"];
  let params = [season];
  let paramIndex = 2;

  if (status === "collected") {
    whereConditions.push("gs.game_id IS NOT NULL");
  } else if (status === "missing") {
    whereConditions.push("gs.game_id IS NULL");
  }

  if (date) {
    whereConditions.push(`DATE(g.game_date) = $${paramIndex}`);
    params.push(date);
    paramIndex++;
  }

  const whereClause = whereConditions.join(" AND ");

  const statsQuery = `
    SELECT
      '${season}' as season,
      COUNT(DISTINCT g.game_id) as total_games,
      COUNT(DISTINCT CASE WHEN gs.game_id IS NOT NULL THEN g.game_id END) as collected_games,
      ROUND(100.0 * COUNT(DISTINCT CASE WHEN gs.game_id IS NOT NULL THEN g.game_id END) /
            COUNT(DISTINCT g.game_id), 2) as collection_percentage
    FROM games g
    LEFT JOIN (
      SELECT DISTINCT game_id FROM game_stats
    ) gs ON g.game_id = gs.game_id
    WHERE g.season = $1
  `;

  const gameQuery = `
    WITH game_teams AS (
      SELECT
        game_id,
        MIN(team_id) as home_team_id,
        MAX(team_id) as away_team_id
      FROM game_stats
      GROUP BY game_id
    ),
    game_info AS (
      SELECT
        g.game_id,
        g.game_date,
        gt.home_team_id,
        t_home.abbreviation as home_team_abbreviation,
        t_home.logo_url as home_team_logo,
        gt.away_team_id,
        t_away.abbreviation as away_team_abbreviation,
        t_away.logo_url as away_team_logo,
        CASE WHEN gs.game_id IS NOT NULL THEN true ELSE false END as collected,
        g.created_at,
        g.updated_at
      FROM games g
      LEFT JOIN game_teams gt ON g.game_id = gt.game_id
      LEFT JOIN teams t_home ON gt.home_team_id = t_home.team_id
      LEFT JOIN teams t_away ON gt.away_team_id = t_away.team_id
      LEFT JOIN (SELECT DISTINCT game_id FROM game_stats) gs ON g.game_id = gs.game_id
      WHERE ${whereClause}
    )
    SELECT * FROM game_info
    ORDER BY game_date DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const [statsResult, gameResult] = await Promise.all([
    db.query(statsQuery, [season]),
    db.query(gameQuery, params),
  ]);

  const stats = statsResult.rows[0] || {
    season,
    total_games: 0,
    collected_games: 0,
    collection_percentage: 0,
  };

  return {
    stats,
    games: gameResult.rows,
    pagination: {
      limit,
      offset,
      total: parseInt(stats.total_games),
    },
  };
}

/**
 * Get aggregated game stats for both teams in a specific game
 * @param {number} gameId - The game ID
 * @param {object} db - Database connection
 * @returns {Promise<object>} - { home, away } teams with aggregated stats
 */
async function getGameStats(gameId, db) {
  const query = `
    SELECT
      gs.game_id,
      g.game_date,
      t.team_id,
      t.abbreviation,
      SUM(gs.pts) as pts,
      SUM(gs.reb) as reb,
      SUM(gs.ast) as ast,
      SUM(gs.stl) as stl,
      SUM(gs.blk) as blk,
      ROUND(AVG(gs.fg_pct::numeric), 2) as fg_pct,
      ROUND(AVG(gs.ft_pct::numeric), 2) as ft_pct,
      ROUND(AVG(gs.three_p_pct::numeric), 2) as three_p_pct,
      SUM(gs.fg) as fg,
      SUM(gs.fga) as fga,
      SUM(gs.ft) as ft,
      SUM(gs.fta) as fta,
      SUM(gs.three_p) as three_p,
      SUM(gs.three_pa) as three_pa
    FROM game_stats gs
    JOIN teams t ON gs.team_id = t.team_id
    JOIN games g ON gs.game_id = g.game_id
    WHERE gs.game_id = $1
    GROUP BY gs.game_id, g.game_date, t.team_id, t.abbreviation
    ORDER BY t.team_id
  `;

  const result = await db.query(query, [gameId]);
  const rows = result.rows;

  if (rows.length === 0) {
    throw new Error(`No stats found for game ${gameId}`);
  }

  // Organize by home (lower team_id) and away (higher team_id)
  const stats = {
    game_id: rows[0].game_id,
    game_date: rows[0].game_date,
    home: rows[0],
    away: rows[1] || null,
  };

  return stats;
}

module.exports = { getAuditGames, getGameStats };
