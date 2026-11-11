/**
 * Migration runner
 *
 * Applies every registered migration that has not been recorded yet, in order,
 * and records each one in the `schema_migrations` table. Safe to call on every
 * API start-up:
 *   - fresh database          -> applies every migration (001 ...)
 *   - up-to-date database     -> applies nothing
 *   - existing environments   -> every migration is idempotent (IF NOT EXISTS /
 *                                deleting stale rows), so the first run simply
 *                                re-applies them harmlessly and records them
 *
 * An advisory lock (held in a transaction on one dedicated connection) keeps two
 * instances that start at the same time from migrating concurrently. A
 * transaction-scoped lock is used on purpose: it also works through a pooled
 * (PgBouncer, transaction mode) connection string such as Neon's.
 *
 * To add a migration: create the next numbered file, then append it to
 * MIGRATIONS below. A test fails if a numbered file is not registered.
 *
 * Running `node migrations/index.js` (or `pnpm run migrate`) applies all pending
 * migrations. Individual files can still be run directly, e.g. `make migrate-prod`.
 */

const MIGRATIONS = [
  { id: "001_init_schema", run: () => require("./001_init_schema").runMigrations() },
  { id: "002_add_team_logos", run: () => require("./002_add_team_logos")() },
  { id: "003_add_team_colors", run: () => require("./003_add_team_colors")() },
  { id: "004_add_advanced_team_metrics", run: () => require("./004_add_advanced_team_metrics")() },
  { id: "005_add_missing_stats", run: () => require("./005_add_missing_stats")() },
  { id: "006_add_per_game_avg_columns", run: () => require("./006_add_per_game_avg_columns")() },
  {
    id: "007_add_starters_bench_game_context",
    run: () => require("./007_add_starters_bench_game_context")(),
  },
  {
    id: "008_add_estimated_advanced_stats",
    run: () => require("./008_add_estimated_advanced_stats")(),
  },
  { id: "009_add_remaining_team_stats", run: () => require("./009_add_remaining_team_stats")() },
  { id: "010_cleanup_stale_rankings", run: () => require("./010_cleanup_stale_rankings")() },
  { id: "011_add_wins_losses", run: () => require("./011_add_wins_losses")() },
  {
    id: "012_cleanup_stale_rankings_pt2",
    run: () => require("./012_cleanup_stale_rankings_pt2")(),
  },
  {
    id: "013_add_game_stats_pct_columns",
    run: () => require("./013_add_game_stats_pct_columns")(),
  },
];

// Arbitrary constant identifying "the schema migration lock" for pg_advisory_xact_lock
const MIGRATION_LOCK_KEY = 727001;

/**
 * Apply all pending migrations.
 * @param {object} [options]
 * @param {object} [options.db] - Database module exposing getClient() (defaults to the app's client)
 * @param {Array<{id: string, run: Function}>} [options.migrations] - Ordered migration list
 * @returns {Promise<string[]>} ids of the migrations applied during this call
 */
async function runPendingMigrations({ db, migrations = MIGRATIONS } = {}) {
  const database = db || require("../src/db/postgresClient");
  const client = await database.getClient();
  const applied = [];

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query("SELECT id FROM schema_migrations");
    const alreadyApplied = new Set(rows.map((row) => row.id));

    try {
      for (const migration of migrations) {
        if (alreadyApplied.has(migration.id)) continue;

        console.log(`Applying migration ${migration.id}...`);
        await migration.run();
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
        applied.push(migration.id);
      }
    } finally {
      // Commit what succeeded so far (also releases the advisory lock) even if a later
      // migration failed; the failure is still rethrown to the caller.
      await client.query("COMMIT");
    }

    if (applied.length === 0) {
      console.log("Database schema is up to date");
    } else {
      console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
    }
    return applied;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Connection may already be unusable; the original error is what matters.
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { runPendingMigrations, MIGRATIONS, MIGRATION_LOCK_KEY };

if (require.main === module) {
  const db = require("../src/db/postgresClient");
  runPendingMigrations()
    .then(() => db.pool.end())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration error:", error.message);
      process.exit(1);
    });
}
