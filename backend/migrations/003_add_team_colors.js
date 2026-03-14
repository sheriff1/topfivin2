const db = require("../src/db/postgresClient");

const migration = `
-- Add team_colors column to teams table if it doesn't exist
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS team_colors JSONB;
`;

async function runMigration() {
  try {
    console.log("Running migration: Add team_colors column to teams...");
    await db.query(migration);
    console.log("✅ Migration complete: team_colors JSONB column added to teams");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration().then(() => process.exit(0));
}

module.exports = runMigration;
