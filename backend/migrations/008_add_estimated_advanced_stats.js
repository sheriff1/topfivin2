const db = require("../src/db/postgresClient");

// ----------------------------------------------------------------------------
// Migration 008: Add estimated advanced stats from BoxScoreAdvancedV3 DF1
//
// BoxScoreAdvancedV3 DF1 provides both "actual" and "estimated" rating variants.
// The "estimated" versions use possession estimates (consistent with the NBA's
// own pace/possession model) vs the actual play-by-play-derived values.
//
// New columns (all were available in the API all along but not captured):
//   e_ortg  → estimatedOffensiveRating
//   e_drtg  → estimatedDefensiveRating
//   e_net_rtg → estimatedNetRating
//   e_pace  → estimatedPace
//
// Existing actual-rating columns (unchanged):
//   ortg, drtg, net_rtg, pace  (from fetch_advanced_extras.py, already stored)
//
// ROLLBACK (run manually if needed — local only):
//   ALTER TABLE game_stats
//     DROP COLUMN IF EXISTS e_ortg,
//     DROP COLUMN IF EXISTS e_drtg,
//     DROP COLUMN IF EXISTS e_net_rtg,
//     DROP COLUMN IF EXISTS e_pace;
//   ALTER TABLE team_stats
//     DROP COLUMN IF EXISTS e_ortg,
//     DROP COLUMN IF EXISTS e_drtg,
//     DROP COLUMN IF EXISTS e_net_rtg,
//     DROP COLUMN IF EXISTS e_pace;
// ----------------------------------------------------------------------------

const migration = `
-- ── game_stats: estimated advanced ratings (DEFAULT NULL for IS NULL resumability) ──

ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS e_ortg      FLOAT DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS e_drtg      FLOAT DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS e_net_rtg   FLOAT DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS e_pace      FLOAT DEFAULT NULL;

-- ── team_stats: averaged versions (DEFAULT 0, derived by derive_team_stats.py) ──

ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS e_ortg      FLOAT DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS e_drtg      FLOAT DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS e_net_rtg   FLOAT DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS e_pace      FLOAT DEFAULT 0;
`;

async function run() {
  const statements = migration
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    console.log("Running migration: 008_add_estimated_advanced_stats");
    for (const stmt of statements) {
      await db.query(stmt);
    }
    console.log("✅ Migration 008 complete:");
    console.log("   • e_ortg, e_drtg, e_net_rtg, e_pace added to game_stats + team_stats");
    console.log("   Next steps:");
    console.log("   1. make fetch-advanced-extras   (backfills new estimated columns)");
    console.log("   2. make derive");
  } catch (err) {
    console.error("❌ Migration 008 failed:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = run;
