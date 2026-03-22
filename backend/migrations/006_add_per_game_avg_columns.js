const db = require("../src/db/postgresClient");

// ----------------------------------------------------------------------------
// Migration 006: Add per-game average columns missing from team_stats
//
// oreb, dreb, pf, and plus_minus are stored as raw totals in game_stats but
// had no corresponding per-game average column in team_stats, preventing them
// from flowing through derive_rankings → frontend.
//
// ROLLBACK (run manually if needed — local only):
//   ALTER TABLE team_stats
//     DROP COLUMN IF EXISTS oreb_avg,
//     DROP COLUMN IF EXISTS dreb_avg,
//     DROP COLUMN IF EXISTS pf_avg,
//     DROP COLUMN IF EXISTS pm_avg;
// ----------------------------------------------------------------------------

const migration = `
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS oreb_avg FLOAT DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS dreb_avg FLOAT DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pf_avg   FLOAT DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pm_avg   FLOAT DEFAULT 0;
`;

async function runMigration() {
  try {
    console.log("Running migration 006: Add per-game avg columns to team_stats...");
    const statements = migration
      .split(";")
      .map((s) =>
        s
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim()
      )
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await db.query(stmt);
    }
    console.log(
      "✅ Migration 006 complete: oreb_avg, dreb_avg, pf_avg, pm_avg added to team_stats"
    );
    console.log("   Next step: make derive");
  } catch (error) {
    console.error("❌ Migration 006 failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0));
}

module.exports = runMigration;
