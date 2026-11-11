const CACHE_KEY = "nba:seasons";
const CACHE_TTL_SECONDS = 300;

/**
 * Seasons present in stored data, newest first. The current season is the
 * latest one: it becomes current as soon as its first rows are stored.
 * Empty database => { current: null, available: [] } (not cached, so the
 * first stored season is picked up immediately).
 */
async function getSeasons(db, cache) {
  const cached = cache ? await cache.get(CACHE_KEY) : null;
  if (cached) return cached;

  const result = await db.query(
    `SELECT season FROM (
       SELECT season FROM team_stats
       UNION
       SELECT season FROM games
     ) s
     ORDER BY season DESC`
  );
  const available = result.rows.map((r) => String(r.season));
  const seasons = { current: available[0] ?? null, available };

  if (cache && seasons.current) await cache.set(CACHE_KEY, seasons, CACHE_TTL_SECONDS);
  return seasons;
}

async function getCurrentSeason(db, cache) {
  return (await getSeasons(db, cache)).current;
}

module.exports = { getSeasons, getCurrentSeason, CACHE_KEY };
