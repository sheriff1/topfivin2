const db = require("../src/db/postgresClient");

// ----------------------------------------------------------------------------
// Migration 005: Add missing team-level stats from existing endpoints
//
// These columns were available in endpoints we already call but were never
// extracted. No new API endpoints needed — the 4 existing backfill scripts
// are updated to extract these additional fields in the same API call.
//
// Endpoints → new columns:
//   BoxScoreAdvancedV3  DF1 → ast_to_tov, ast_ratio, tov_ratio
//   BoxScoreMiscV3      DF1 → opp_pts_off_to, opp_pts_second_chance, blk_against, fouls_drawn
//   BoxScoreSummaryV3   DF7 → tov_team, tov_total, reb_team
//   BoxScoreHustleV2    DF1 → contested_shots_2pt, contested_shots_3pt, charges_drawn,
//                             loose_balls_off, loose_balls_def, box_outs_off, box_outs_def
//
// ROLLBACK (run manually if needed — local only):
//   ALTER TABLE game_stats
//     DROP COLUMN IF EXISTS ast_to_tov, DROP COLUMN IF EXISTS ast_ratio,
//     DROP COLUMN IF EXISTS tov_ratio, DROP COLUMN IF EXISTS opp_pts_off_to,
//     DROP COLUMN IF EXISTS opp_pts_second_chance, DROP COLUMN IF EXISTS blk_against,
//     DROP COLUMN IF EXISTS fouls_drawn, DROP COLUMN IF EXISTS tov_team,
//     DROP COLUMN IF EXISTS tov_total, DROP COLUMN IF EXISTS reb_team,
//     DROP COLUMN IF EXISTS contested_shots_2pt, DROP COLUMN IF EXISTS contested_shots_3pt,
//     DROP COLUMN IF EXISTS charges_drawn, DROP COLUMN IF EXISTS loose_balls_off,
//     DROP COLUMN IF EXISTS loose_balls_def, DROP COLUMN IF EXISTS box_outs_off,
//     DROP COLUMN IF EXISTS box_outs_def;
//
//   ALTER TABLE team_stats
//     DROP COLUMN IF EXISTS ast_to_tov, DROP COLUMN IF EXISTS ast_ratio,
//     DROP COLUMN IF EXISTS tov_ratio, DROP COLUMN IF EXISTS opp_pts_off_to,
//     DROP COLUMN IF EXISTS opp_pts_second_chance, DROP COLUMN IF EXISTS blk_against,
//     DROP COLUMN IF EXISTS fouls_drawn, DROP COLUMN IF EXISTS tov_team,
//     DROP COLUMN IF EXISTS tov_total, DROP COLUMN IF EXISTS reb_team,
//     DROP COLUMN IF EXISTS contested_shots_2pt, DROP COLUMN IF EXISTS contested_shots_3pt,
//     DROP COLUMN IF EXISTS charges_drawn, DROP COLUMN IF EXISTS loose_balls_off,
//     DROP COLUMN IF EXISTS loose_balls_def, DROP COLUMN IF EXISTS box_outs_off,
//     DROP COLUMN IF EXISTS box_outs_def;
// ----------------------------------------------------------------------------

const migration = `
-- ── game_stats: new columns (DEFAULT NULL for IS NULL resumability) ──────────

-- BoxScoreAdvancedV3 extras
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS ast_to_tov           FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS ast_ratio            FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS tov_ratio            FLOAT  DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS pace_per40           FLOAT  DEFAULT NULL;

-- BoxScoreMiscV3 extras
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS opp_pts_off_to       INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS opp_pts_second_chance INT   DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS blk_against          INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS fouls_drawn          INT    DEFAULT NULL;

-- BoxScoreSummaryV3 DF7 extras
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS tov_team             INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS tov_total            INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS reb_team             INT    DEFAULT NULL;

-- BoxScoreHustleV2 extras
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS contested_shots_2pt  INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS contested_shots_3pt  INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS charges_drawn        INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS loose_balls_off      INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS loose_balls_def      INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS box_outs_off         INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS box_outs_def         INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS box_out_team_reb     INT    DEFAULT NULL;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS box_out_player_reb   INT    DEFAULT NULL;


-- ── team_stats: averaged versions (DEFAULT 0, derived by derive_team_stats.py) ──

-- BoxScoreAdvancedV3 extras
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS ast_to_tov           FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS ast_ratio            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS tov_ratio            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS pace_per40           FLOAT  DEFAULT 0;

-- BoxScoreMiscV3 extras
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS opp_pts_off_to       FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS opp_pts_second_chance FLOAT DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS blk_against          FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS fouls_drawn          FLOAT  DEFAULT 0;

-- BoxScoreSummaryV3 DF7 extras
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS tov_team             FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS tov_total            FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS reb_team             FLOAT  DEFAULT 0;

-- BoxScoreHustleV2 extras
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS contested_shots_2pt  FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS contested_shots_3pt  FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS charges_drawn        FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS loose_balls_off      FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS loose_balls_def      FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS box_outs_off         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS box_outs_def         FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS box_out_team_reb     FLOAT  DEFAULT 0;
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS box_out_player_reb   FLOAT  DEFAULT 0;
`;

async function runMigration() {
  try {
    console.log("Running migration 005: Add missing box score stats...");
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
    console.log("✅ Migration 005 complete: 20 new columns added to game_stats and team_stats");
    console.log("   Next steps:");
    console.log("   1. make backfill-missing   (runs all 4 updated backfill scripts)");
    console.log("   2. make derive");
  } catch (error) {
    console.error("❌ Migration 005 failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0));
}

module.exports = runMigration;
