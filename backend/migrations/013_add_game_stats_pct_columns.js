const db = require("../src/db/postgresClient");

// ----------------------------------------------------------------------------
// Migration 013: add the advanced-percentage columns to game_stats
//
// fetch_nba_stats.py inserts these seven columns into game_stats and
// derive_team_stats.py averages them, but migration 001 only created them on
// team_stats. Existing databases had them added by hand, so a database built
// purely from migrations (e.g. a brand-new host) was missing them and the
// pipeline failed. IF NOT EXISTS makes this a no-op where they already exist.
// ----------------------------------------------------------------------------

const migration = `
ALTER TABLE game_stats
  ADD COLUMN IF NOT EXISTS orb_pct FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drb_pct FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trb_pct FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ast_pct FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tov_pct FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usg_pct FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ts_pct  FLOAT DEFAULT 0
`;

async function run() {
  console.log("Running migration: 013_add_game_stats_pct_columns");
  await db.query(migration);
  console.log("✅ Migration 013 complete: game_stats percentage columns ensured");
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Migration 013 failed:", err.message);
      process.exit(1);
    });
}

module.exports = run;
