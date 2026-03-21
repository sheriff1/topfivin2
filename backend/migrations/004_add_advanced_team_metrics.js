const db = require("../src/db/postgresClient");

// ----------------------------------------------------------------------------
// Migration 004: Add advanced team metrics to game_stats and team_stats
//
// New columns come from three NBA API V3 endpoints that were previously
// untapped (or partially tapped). All game_stats columns are DEFAULT NULL so
// the IS NULL resumability check works in the backfill scripts.
//
// Endpoints → columns:
//   BoxScoreAdvancedV3  DF1 → ortg, drtg, net_rtg, efg_pct, pace, possessions, pie
//   BoxScoreSummaryV3   DF7 → biggest_lead, bench_points, lead_changes, times_tied, biggest_scoring_run
//   BoxScoreMiscV3      DF1 → pts_paint, pts_fast_break, pts_second_chance, pts_off_to,
//                             opp_pts_paint, opp_pts_fast_break
//   BoxScoreHustleV2    DF1 → contested_shots, deflections, screen_assists, screen_assist_pts,
//                             box_outs, loose_balls_recovered
//
// ROLLBACK (run manually if needed — local only):
//   ALTER TABLE game_stats
//     DROP COLUMN IF EXISTS ortg, DROP COLUMN IF EXISTS drtg, DROP COLUMN IF EXISTS net_rtg,
//     DROP COLUMN IF EXISTS efg_pct, DROP COLUMN IF EXISTS pace, DROP COLUMN IF EXISTS possessions,
//     DROP COLUMN IF EXISTS pie, DROP COLUMN IF EXISTS biggest_lead,
//     DROP COLUMN IF EXISTS bench_points, DROP COLUMN IF EXISTS lead_changes,
//     DROP COLUMN IF EXISTS times_tied, DROP COLUMN IF EXISTS biggest_scoring_run,
//     DROP COLUMN IF EXISTS pts_paint, DROP COLUMN IF EXISTS pts_fast_break,
//     DROP COLUMN IF EXISTS pts_second_chance, DROP COLUMN IF EXISTS pts_off_to,
//     DROP COLUMN IF EXISTS opp_pts_paint, DROP COLUMN IF EXISTS opp_pts_fast_break,
//     DROP COLUMN IF EXISTS contested_shots, DROP COLUMN IF EXISTS deflections,
//     DROP COLUMN IF EXISTS screen_assists, DROP COLUMN IF EXISTS screen_assist_pts,
//     DROP COLUMN IF EXISTS box_outs, DROP COLUMN IF EXISTS loose_balls_recovered;
//
//   ALTER TABLE team_stats
//     DROP COLUMN IF EXISTS ortg, DROP COLUMN IF EXISTS drtg, DROP COLUMN IF EXISTS net_rtg,
//     DROP COLUMN IF EXISTS efg_pct, DROP COLUMN IF EXISTS pace, DROP COLUMN IF EXISTS possessions,
//     DROP COLUMN IF EXISTS pie, DROP COLUMN IF EXISTS biggest_lead,
//     DROP COLUMN IF EXISTS bench_points, DROP COLUMN IF EXISTS lead_changes,
//     DROP COLUMN IF EXISTS times_tied, DROP COLUMN IF EXISTS biggest_scoring_run,
//     DROP COLUMN IF EXISTS pts_paint, DROP COLUMN IF EXISTS pts_fast_break,
//     DROP COLUMN IF EXISTS pts_second_chance, DROP COLUMN IF EXISTS pts_off_to,
//     DROP COLUMN IF EXISTS opp_pts_paint, DROP COLUMN IF EXISTS opp_pts_fast_break,
//     DROP COLUMN IF EXISTS contested_shots, DROP COLUMN IF EXISTS deflections,
//     DROP COLUMN IF EXISTS screen_assists, DROP COLUMN IF EXISTS screen_assist_pts,
//     DROP COLUMN IF EXISTS box_outs, DROP COLUMN IF EXISTS loose_balls_recovered;
// ----------------------------------------------------------------------------

const migration = `
-- ── game_stats: new columns (DEFAULT NULL for IS NULL resumability) ──────────

-- BoxScoreAdvancedV3 extras (offensiveRating, defensiveRating, etc.)
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS ortg             FLOAT   DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS drtg             FLOAT   DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS net_rtg          FLOAT   DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS efg_pct          FLOAT   DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pace             FLOAT   DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS possessions      FLOAT   DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pie              FLOAT   DEFAULT NULL;

-- BoxScoreSummaryV3 DF7 extras
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS biggest_lead          INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_points          INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS lead_changes          INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS times_tied            INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS biggest_scoring_run   INT  DEFAULT NULL;

-- BoxScoreMiscV3
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pts_paint             INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pts_fast_break        INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pts_second_chance     INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pts_off_to            INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS opp_pts_paint         INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS opp_pts_fast_break    INT  DEFAULT NULL;

-- BoxScoreHustleV2
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS contested_shots       INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS deflections           INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS screen_assists        INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS screen_assist_pts     INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS box_outs              INT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS loose_balls_recovered INT  DEFAULT NULL;


-- ── team_stats: averaged versions (DEFAULT 0, derived by derive_team_stats.py) ──

-- BoxScoreAdvancedV3 extras
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS ortg             FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS drtg             FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS net_rtg          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS efg_pct          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pace             FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS possessions      FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pie              FLOAT  DEFAULT 0;

-- BoxScoreSummaryV3 DF7 extras
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS biggest_lead          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_points          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS lead_changes          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS times_tied            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS biggest_scoring_run   FLOAT  DEFAULT 0;

-- BoxScoreMiscV3
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pts_paint             FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pts_fast_break        FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pts_second_chance     FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pts_off_to            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS opp_pts_paint         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS opp_pts_fast_break    FLOAT  DEFAULT 0;

-- BoxScoreHustleV2
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS contested_shots       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS deflections           FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS screen_assists        FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS screen_assist_pts     FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS box_outs              FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS loose_balls_recovered FLOAT  DEFAULT 0;
`;

async function runMigration() {
  try {
    console.log("Running migration 004: Add advanced team metrics...");
    // Run each statement individually so a failure is clearly attributed
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
    console.log("✅ Migration 004 complete: 24 new columns added to game_stats and team_stats");
    console.log("   Next steps:");
    console.log("   1. make fetch-advanced-extras");
    console.log("   2. make fetch-summary-extras");
    console.log("   3. make fetch-misc");
    console.log("   4. make fetch-hustle");
    console.log("   5. make derive");
  } catch (error) {
    console.error("❌ Migration 004 failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0));
}

module.exports = runMigration;
