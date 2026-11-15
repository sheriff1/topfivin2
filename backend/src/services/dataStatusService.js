const { getCurrentSeason } = require("./seasonService");

const CACHE_KEY = "nba:data-status";
const CACHE_TTL_SECONDS = 300;

/**
 * How fresh the stored data is for the current season:
 *  - latestGameDate: newest stored game, MAX(game_stats.game_date), as YYYY-MM-DD
 *  - lastFetchedAt: when a game was last collected, MAX(games.updated_at) WHERE collected,
 *    as an ISO-8601 UTC timestamp. fetch_nba_stats.py sets it per collected game; derive
 *    reruns touch team_stats/stat_rankings instead, so they do not move it. The column is
 *    TIMESTAMP (no zone); fetch_nba_stats.py writes it as UTC explicitly, so it is labelled
 *    UTC here whatever the database session time zone is.
 * Either value is null when the season has no matching rows. Empty database => null
 * (not cached, so the first stored season is picked up immediately).
 */
async function getDataStatus(db, cache) {
  const cached = cache ? await cache.get(CACHE_KEY) : null;
  if (cached) return cached;

  const season = await getCurrentSeason(db, cache);
  if (!season) return null;

  const [latest, fetched] = await Promise.all([
    db.query(
      `SELECT to_char(MAX(game_date), 'YYYY-MM-DD') AS latest_game_date
       FROM game_stats WHERE season = $1`,
      [season]
    ),
    db.query(
      `SELECT to_char(MAX(updated_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_fetched_at
       FROM games WHERE season = $1 AND collected = true`,
      [season]
    ),
  ]);

  const status = {
    season,
    latestGameDate: latest.rows[0]?.latest_game_date ?? null,
    lastFetchedAt: fetched.rows[0]?.last_fetched_at ?? null,
  };

  if (cache) await cache.set(CACHE_KEY, status, CACHE_TTL_SECONDS);
  return status;
}

module.exports = { getDataStatus, CACHE_KEY };
