const db = require("../src/db/postgresClient");

async function run() {
  try {
    console.log("Running migration: 012_cleanup_stale_rankings_pt2");

    // Remove stale stat_rankings rows whose stat_category values no longer match
    // any key in STAT_CATEGORIES (left over from older derive_rankings.py runs):
    //   CONTESTED_FG_PCT → renamed to CONTESTED_FG%
    //   UNCONTESTED_FG_PCT → renamed to UNCONTESTED_FG%
    //   DAR_FG_PCT → renamed to DAR_FG%
    //   BENCH_PM / STARTERS_PM → removed from pipeline entirely
    const result = await db.query(`
      DELETE FROM stat_rankings
      WHERE stat_category IN (
        'CONTESTED_FG_PCT',
        'UNCONTESTED_FG_PCT',
        'DAR_FG_PCT',
        'BENCH_PM',
        'STARTERS_PM'
      )
    `);
    console.log(`✅ Migration 012 complete: removed ${result.rowCount} stale stat_rankings rows`);
  } catch (err) {
    console.error("❌ Migration 012 failed:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = run;
