async function getTeamStats(teamId, season, db) {
  const query = `
    SELECT
      t.team_id,
      t.team_name,
      ts.season,
      ts.games_played,
      ts.fg, ts.fga, ts.fg_pct,
      ts.three_p, ts.three_pa, ts.three_p_pct,
      ts.ft, ts.fta, ts.ft_pct,
      ts.oreb, ts.dreb, ts.reb,
      ts.ast, ts.tov, ts.stl, ts.blk, ts.pf, ts.pts,
      ts.fg_avg, ts.fga_avg, ts.three_p_avg,
      ts.reb_avg, ts.ast_avg, ts.tov_avg, ts.stl_avg, ts.blk_avg, ts.pts_avg
    FROM team_stats ts
    LEFT JOIN teams t ON ts.team_id = t.team_id
    WHERE ts.team_id = $1 AND ts.season = $2
  `;

  const result = await db.query(query, [teamId, season]);

  if (result.rows.length === 0) return null;

  const team = result.rows[0];
  return {
    team_id: team.team_id,
    team_name: team.team_name,
    season: team.season,
    games_played: team.games_played,
    stats: {
      fg: team.fg, fga: team.fga, fg_pct: team.fg_pct,
      three_p: team.three_p, three_pa: team.three_pa, three_p_pct: team.three_p_pct,
      ft: team.ft, fta: team.fta, ft_pct: team.ft_pct,
      oreb: team.oreb, dreb: team.dreb, reb: team.reb,
      ast: team.ast, tov: team.tov, stl: team.stl, blk: team.blk, pf: team.pf, pts: team.pts,
      fg_avg: team.fg_avg, fga_avg: team.fga_avg, three_p_avg: team.three_p_avg,
      reb_avg: team.reb_avg, ast_avg: team.ast_avg, tov_avg: team.tov_avg,
      stl_avg: team.stl_avg, blk_avg: team.blk_avg, pts_avg: team.pts_avg,
    },
  };
}

async function getTeamRankings(teamId, season, db) {
  const query = `
    SELECT
      sr.stat_category,
      sr.rank,
      sr.value,
      t.team_name
    FROM stat_rankings sr
    LEFT JOIN teams t ON sr.team_id = t.team_id
    WHERE sr.team_id = $1 AND sr.season = $2
    ORDER BY sr.stat_category ASC
  `;

  const result = await db.query(query, [teamId, season]);

  if (result.rows.length === 0) return null;

  return {
    team_name: result.rows[0].team_name,
    rankings: result.rows.map(r => ({
      stat_category: r.stat_category,
      rank: r.rank,
      value: r.value,
    })),
  };
}

module.exports = { getTeamStats, getTeamRankings };
