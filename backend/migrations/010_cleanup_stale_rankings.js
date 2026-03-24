const db = require("../src/db/postgresClient");

// ----------------------------------------------------------------------------
// Migration 010: Delete stale stat_rankings rows with renamed category codes
//
// When derive_rankings.py category codes are renamed, old rows remain in
// stat_rankings because the upsert key is (team_id, stat_category, season).
// Old rows are never overwritten — they accumulate as orphans that have no
// matching label in statProcessor.js STAT_CATEGORIES, causing the raw code
// (e.g. "BENCH_PTS") to appear in the UI instead of a human-readable label.
//
// Known renamed codes:
//   BENCH_PTS → replaced by BENCH_PPG (bench_pts column, same data)
//
// ROLLBACK: None needed — data will be re-derived on next `make derive-prod`
//           using the current correct codes.
// ----------------------------------------------------------------------------

async function run() {
  try {
    console.log("Running migration: 010_cleanup_stale_rankings");

    const result = await db.query(`
      DELETE FROM stat_rankings
      WHERE stat_category = 'BENCH_PTS'
    `);

    console.log(
      `✅ Migration 010 complete: deleted ${result.rowCount} stale BENCH_PTS ranking rows`
    );
  } catch (err) {
    console.error("❌ Migration 010 failed:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = run;
