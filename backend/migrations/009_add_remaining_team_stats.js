const db = require("../src/db/postgresClient");

// ----------------------------------------------------------------------------
// Migration 009: Add remaining box score stats (4 new endpoints)
//
// Captures all columns that were available in existing NBA API endpoints
// but had not yet been stored. Four source endpoints:
//
//   BoxScoreAdvancedV3 DF1 (extras beyond what fetch_advanced_extras.py already stores):
//     dreb_pct, reb_pct, e_tov_pct, e_usage_pct
//
//   BoxScoreFourFactorsV3 DF1:
//     ft_rate, tm_tov_pct, oreb_pct, opp_efg_pct, opp_ft_rate, opp_tov_pct, opp_oreb_pct
//
//   BoxScoreSummaryV3 DF7 (additional column beyond what fetch_summary_extras.py stores):
//     pts_from_tov
//
//   BoxScoreScoringV3 DF1 (15 scoring distribution %):
//     pct_fga_2pt, pct_fga_3pt, pct_pts_2pt, pct_pts_2pt_mr, pct_pts_3pt,
//     pct_pts_fb, pct_pts_ft, pct_pts_off_tov, pct_pts_paint,
//     pct_ast_2pm, pct_uast_2pm, pct_ast_3pm, pct_uast_3pm, pct_ast_fgm, pct_uast_fgm
//
//   BoxScorePlayerTrackV3 DF1 (17 tracking stats):
//     distance, reb_chances_off, reb_chances_def, reb_chances_total,
//     touches, secondary_ast, ft_ast, passes,
//     contested_fgm, contested_fga, contested_fg_pct,
//     uncontested_fgm, uncontested_fga, uncontested_fg_pct,
//     dar_fgm, dar_fga, dar_fg_pct
//
// ROLLBACK (run manually if needed — local only):
//   ALTER TABLE game_stats
//     DROP COLUMN IF EXISTS dreb_pct, DROP COLUMN IF EXISTS reb_pct,
//     DROP COLUMN IF EXISTS e_tov_pct, DROP COLUMN IF EXISTS e_usage_pct,
//     DROP COLUMN IF EXISTS ft_rate, DROP COLUMN IF EXISTS tm_tov_pct,
//     DROP COLUMN IF EXISTS oreb_pct, DROP COLUMN IF EXISTS opp_efg_pct,
//     DROP COLUMN IF EXISTS opp_ft_rate, DROP COLUMN IF EXISTS opp_tov_pct,
//     DROP COLUMN IF EXISTS opp_oreb_pct, DROP COLUMN IF EXISTS pts_from_tov,
//     DROP COLUMN IF EXISTS pct_fga_2pt, DROP COLUMN IF EXISTS pct_fga_3pt,
//     DROP COLUMN IF EXISTS pct_pts_2pt, DROP COLUMN IF EXISTS pct_pts_2pt_mr,
//     DROP COLUMN IF EXISTS pct_pts_3pt, DROP COLUMN IF EXISTS pct_pts_fb,
//     DROP COLUMN IF EXISTS pct_pts_ft, DROP COLUMN IF EXISTS pct_pts_off_tov,
//     DROP COLUMN IF EXISTS pct_pts_paint, DROP COLUMN IF EXISTS pct_ast_2pm,
//     DROP COLUMN IF EXISTS pct_uast_2pm, DROP COLUMN IF EXISTS pct_ast_3pm,
//     DROP COLUMN IF EXISTS pct_uast_3pm, DROP COLUMN IF EXISTS pct_ast_fgm,
//     DROP COLUMN IF EXISTS pct_uast_fgm, DROP COLUMN IF EXISTS distance,
//     DROP COLUMN IF EXISTS reb_chances_off, DROP COLUMN IF EXISTS reb_chances_def,
//     DROP COLUMN IF EXISTS reb_chances_total, DROP COLUMN IF EXISTS touches,
//     DROP COLUMN IF EXISTS secondary_ast, DROP COLUMN IF EXISTS ft_ast,
//     DROP COLUMN IF EXISTS passes, DROP COLUMN IF EXISTS contested_fgm,
//     DROP COLUMN IF EXISTS contested_fga, DROP COLUMN IF EXISTS contested_fg_pct,
//     DROP COLUMN IF EXISTS uncontested_fgm, DROP COLUMN IF EXISTS uncontested_fga,
//     DROP COLUMN IF EXISTS uncontested_fg_pct, DROP COLUMN IF EXISTS dar_fgm,
//     DROP COLUMN IF EXISTS dar_fga, DROP COLUMN IF EXISTS dar_fg_pct;
//
//   (Mirror on team_stats with the same column names)
// ----------------------------------------------------------------------------

const migration = `
-- ── game_stats: BoxScoreAdvancedV3 DF1 extras (DEFAULT NULL for IS NULL resumability) ──

ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS dreb_pct          FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS reb_pct           FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS e_tov_pct         FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS e_usage_pct       FLOAT  DEFAULT NULL;

-- ── game_stats: BoxScoreFourFactorsV3 DF1 ────────────────────────────────────

ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS ft_rate           FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS tm_tov_pct        FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS oreb_pct          FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS opp_efg_pct       FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS opp_ft_rate       FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS opp_tov_pct       FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS opp_oreb_pct      FLOAT  DEFAULT NULL;

-- ── game_stats: BoxScoreSummaryV3 DF7 extra ──────────────────────────────────

ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pts_from_tov      INT    DEFAULT NULL;

-- ── game_stats: BoxScoreScoringV3 DF1 (15 scoring % columns) ────────────────

ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_fga_2pt       FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_fga_3pt       FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_pts_2pt       FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_pts_2pt_mr    FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_pts_3pt       FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_pts_fb        FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_pts_ft        FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_pts_off_tov   FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_pts_paint     FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_ast_2pm       FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_uast_2pm      FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_ast_3pm       FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_uast_3pm      FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_ast_fgm       FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pct_uast_fgm      FLOAT  DEFAULT NULL;

-- ── game_stats: BoxScorePlayerTrackV3 DF1 (17 tracking columns) ─────────────

ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS distance          FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS reb_chances_off   INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS reb_chances_def   INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS reb_chances_total INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS touches           INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS secondary_ast     INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS ft_ast            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS passes            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS contested_fgm     INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS contested_fga     INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS contested_fg_pct  FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS uncontested_fgm   INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS uncontested_fga   INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS uncontested_fg_pct FLOAT DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS dar_fgm           INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS dar_fga           INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS dar_fg_pct        FLOAT  DEFAULT NULL;

-- ── team_stats: averaged versions (DEFAULT 0, derived by derive_team_stats.py) ──

ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS dreb_pct          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS reb_pct           FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS e_tov_pct         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS e_usage_pct       FLOAT  DEFAULT 0;

ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS ft_rate           FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS tm_tov_pct        FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS oreb_pct          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS opp_efg_pct       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS opp_ft_rate       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS opp_tov_pct       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS opp_oreb_pct      FLOAT  DEFAULT 0;

ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pts_from_tov      FLOAT  DEFAULT 0;

ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_fga_2pt       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_fga_3pt       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_pts_2pt       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_pts_2pt_mr    FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_pts_3pt       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_pts_fb        FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_pts_ft        FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_pts_off_tov   FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_pts_paint     FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_ast_2pm       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_uast_2pm      FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_ast_3pm       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_uast_3pm      FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_ast_fgm       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pct_uast_fgm      FLOAT  DEFAULT 0;

ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS distance          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS reb_chances_off   FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS reb_chances_def   FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS reb_chances_total FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS touches           FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS secondary_ast     FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS ft_ast            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS passes            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS contested_fgm     FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS contested_fga     FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS contested_fg_pct  FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS uncontested_fgm   FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS uncontested_fga   FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS uncontested_fg_pct FLOAT DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS dar_fgm           FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS dar_fga           FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS dar_fg_pct        FLOAT  DEFAULT 0;
`;

async function run() {
  const statements = migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    console.log("Running migration: 009_add_remaining_team_stats");
    for (const stmt of statements) {
      await db.query(stmt);
    }
    console.log("✅ Migration 009 complete:");
    console.log("   • 4 AdvancedV3 extras         (dreb_pct, reb_pct, e_tov_pct, e_usage_pct)");
    console.log("   • 7 FourFactorsV3             (ft_rate, tm_tov_pct, oreb_pct, opp_*)");
    console.log("   • 1 SummaryV3 extra           (pts_from_tov)");
    console.log("   • 15 ScoringV3 percentages    (pct_fga_*, pct_pts_*, pct_ast_*, pct_uast_*)");
    console.log("   • 17 PlayerTrackV3            (distance, reb_chances_*, touches, passes, ...)");
    console.log("   Added to both game_stats (DEFAULT NULL) and team_stats (DEFAULT 0)");
    console.log("   Next steps:");
    console.log(
      "   1. make fetch-advanced-extras   (backfills dreb_pct, reb_pct, e_tov_pct, e_usage_pct)"
    );
    console.log("   2. make fetch-summary           (backfills pts_from_tov)");
    console.log("   3. make fetch-fourfactors       (backfills ft_rate and FourFactors columns)");
    console.log("   4. make fetch-scoring           (backfills scoring distribution %)");
    console.log("   5. make fetch-playertrack       (backfills PlayerTrack columns)");
    console.log("   6. make derive");
  } catch (err) {
    console.error("❌ Migration 009 failed:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = run;
