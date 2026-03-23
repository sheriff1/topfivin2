const db = require("../src/db/postgresClient");

// ----------------------------------------------------------------------------
// Migration 007: Add starters/bench split stats + game context stats
//
// Two new data sources, both from endpoints already in use:
//
//   BoxScoreTraditionalV3 DF1 → per-team starters vs bench group stats
//     starters_fg, starters_fga, starters_fg_pct,
//     starters_three_p, starters_three_pa, starters_three_p_pct,
//     starters_ft, starters_fta, starters_ft_pct,
//     starters_oreb, starters_dreb, starters_reb,
//     starters_ast, starters_stl, starters_blk, starters_tov,
//     starters_pf, starters_pts, starters_pm
//     (same 19 cols with bench_ prefix)
//
//   BoxScoreSummaryV3 DF0 → attendance, duration_mins (game-level)
//   BoxScoreSummaryV3 DF4 → per-team quarterly scores (q1_pts … q4_pts)
//
// ROLLBACK (run manually if needed — local only):
//   ALTER TABLE game_stats
//     DROP COLUMN IF EXISTS starters_fg, DROP COLUMN IF EXISTS starters_fga,
//     DROP COLUMN IF EXISTS starters_fg_pct, DROP COLUMN IF EXISTS starters_three_p,
//     DROP COLUMN IF EXISTS starters_three_pa, DROP COLUMN IF EXISTS starters_three_p_pct,
//     DROP COLUMN IF EXISTS starters_ft, DROP COLUMN IF EXISTS starters_fta,
//     DROP COLUMN IF EXISTS starters_ft_pct, DROP COLUMN IF EXISTS starters_oreb,
//     DROP COLUMN IF EXISTS starters_dreb, DROP COLUMN IF EXISTS starters_reb,
//     DROP COLUMN IF EXISTS starters_ast, DROP COLUMN IF EXISTS starters_stl,
//     DROP COLUMN IF EXISTS starters_blk, DROP COLUMN IF EXISTS starters_tov,
//     DROP COLUMN IF EXISTS starters_pf, DROP COLUMN IF EXISTS starters_pts,
//     DROP COLUMN IF EXISTS starters_pm,
//     DROP COLUMN IF EXISTS bench_fg, DROP COLUMN IF EXISTS bench_fga,
//     DROP COLUMN IF EXISTS bench_fg_pct, DROP COLUMN IF EXISTS bench_three_p,
//     DROP COLUMN IF EXISTS bench_three_pa, DROP COLUMN IF EXISTS bench_three_p_pct,
//     DROP COLUMN IF EXISTS bench_ft, DROP COLUMN IF EXISTS bench_fta,
//     DROP COLUMN IF EXISTS bench_ft_pct, DROP COLUMN IF EXISTS bench_oreb,
//     DROP COLUMN IF EXISTS bench_dreb, DROP COLUMN IF EXISTS bench_reb,
//     DROP COLUMN IF EXISTS bench_ast, DROP COLUMN IF EXISTS bench_stl,
//     DROP COLUMN IF EXISTS bench_blk, DROP COLUMN IF EXISTS bench_tov,
//     DROP COLUMN IF EXISTS bench_pf, DROP COLUMN IF EXISTS bench_pts,
//     DROP COLUMN IF EXISTS bench_pm,
//     DROP COLUMN IF EXISTS attendance, DROP COLUMN IF EXISTS duration_mins,
//     DROP COLUMN IF EXISTS q1_pts, DROP COLUMN IF EXISTS q2_pts,
//     DROP COLUMN IF EXISTS q3_pts, DROP COLUMN IF EXISTS q4_pts;
//
//   (Mirror on team_stats with the same column names)
// ----------------------------------------------------------------------------

const migration = `
-- ── game_stats: starters group (DEFAULT NULL for IS NULL resumability) ──────

ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_fg          INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_fga         INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_fg_pct      FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_three_p     INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_three_pa    INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_three_p_pct FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_ft          INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_fta         INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_ft_pct      FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_oreb        INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_dreb        INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_reb         INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_ast         INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_stl         INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_blk         INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_tov         INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_pf          INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_pts         INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS starters_pm          FLOAT  DEFAULT NULL;

-- ── game_stats: bench group ──────────────────────────────────────────────────

ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_fg             INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_fga            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_fg_pct         FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_three_p        INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_three_pa       INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_three_p_pct    FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_ft             INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_fta            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_ft_pct         FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_oreb           INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_dreb           INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_reb            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_ast            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_stl            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_blk            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_tov            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_pf             INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_pts            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS bench_pm             FLOAT  DEFAULT NULL;

-- ── game_stats: game context ─────────────────────────────────────────────────

ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS attendance           INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS duration_mins        FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS q1_pts               INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS q2_pts               INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS q3_pts               INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS q4_pts               INT    DEFAULT NULL;

-- ── team_stats: averaged versions (DEFAULT 0, derived by derive_team_stats.py) ──

ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_fg          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_fga         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_fg_pct      FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_three_p     FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_three_pa    FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_three_p_pct FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_ft          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_fta         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_ft_pct      FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_oreb        FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_dreb        FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_reb         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_ast         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_stl         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_blk         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_tov         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_pf          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_pts         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS starters_pm          FLOAT  DEFAULT 0;

ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_fg             FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_fga            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_fg_pct         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_three_p        FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_three_pa       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_three_p_pct    FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_ft             FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_fta            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_ft_pct         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_oreb           FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_dreb           FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_reb            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_ast            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_stl            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_blk            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_tov            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_pf             FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_pts            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS bench_pm             FLOAT  DEFAULT 0;

ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS attendance           FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS duration_mins        FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS q1_pts               FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS q2_pts               FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS q3_pts               FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS q4_pts               FLOAT  DEFAULT 0;
`;

async function runMigration() {
  try {
    console.log("Running migration 007: Add starters/bench split + game context stats...");
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
    console.log("✅ Migration 007 complete:");
    console.log("   • 19 starters_* columns in game_stats + team_stats");
    console.log("   • 19 bench_* columns in game_stats + team_stats");
    console.log("   • 6 game context columns (attendance, duration_mins, q1-q4_pts)");
    console.log("   Next steps:");
    console.log("   1. make fetch-starters-bench   (BoxScoreTraditionalV3 DF1)");
    console.log("   2. make fetch-game-context      (BoxScoreSummaryV3 DF0 + DF4)");
    console.log("   3. make derive");
  } catch (error) {
    console.error("❌ Migration 007 failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0));
}

module.exports = runMigration;
