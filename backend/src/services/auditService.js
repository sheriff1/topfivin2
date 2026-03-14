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
        t_home.team_name as home_team_name,
        gt.away_team_id,
        t_away.team_name as away_team_name,
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

module.exports = { getAuditGames };
