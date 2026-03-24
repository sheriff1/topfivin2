const db = require("../src/db/postgresClient");

async function run() {
  try {
    console.log("Running migration: 011_add_wins_losses");

    // Add win column to game_stats (1 = win, 0 = loss, NULL = unknown)
    await db.query(`
      ALTER TABLE game_stats
        ADD COLUMN IF NOT EXISTS win INT DEFAULT NULL
    `);
    console.log("  ✅ Added win column to game_stats");

    // Add wins, losses, win_pct to team_stats
    await db.query(`
      ALTER TABLE team_stats
        ADD COLUMN IF NOT EXISTS wins    INT   DEFAULT 0,
        ADD COLUMN IF NOT EXISTS losses  INT   DEFAULT 0,
        ADD COLUMN IF NOT EXISTS win_pct FLOAT DEFAULT 0
    `);
    console.log("  ✅ Added wins, losses, win_pct columns to team_stats");

    console.log("✅ Migration 011 complete: wins/losses columns added");
  } catch (err) {
    console.error("❌ Migration 011 failed:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = run;
