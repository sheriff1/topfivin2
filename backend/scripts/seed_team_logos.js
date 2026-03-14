const db = require("../src/db/postgresClient");

// NBA CDN logo URL pattern: https://cdn.nba.com/logos/nba/{team_id}/primary/logo.svg
const NBA_CDN_BASE = "https://cdn.nba.com/logos/nba";

async function seedTeamLogos() {
  try {
    console.log("Seeding team logos from NBA CDN...");

    // Get all teams from the database
    const result = await db.query("SELECT id, team_id, team_name FROM teams ORDER BY team_id");
    const teams = result.rows;

    if (teams.length === 0) {
      console.log("ℹ️  No teams found in database. Run fetch_nba_stats.py first.");
      return;
    }

    console.log(`Found ${teams.length} teams. Generating logo URLs...`);

    let updated = 0;

    for (const team of teams) {
      const logoUrl = `${NBA_CDN_BASE}/${team.team_id}/primary/logo.svg`;

      try {
        await db.query("UPDATE teams SET logo_url = $1 WHERE team_id = $2", [logoUrl, team.team_id]);
        updated++;
        console.log(`✅ ${team.team_name}: ${logoUrl}`);
      } catch (error) {
        console.error(`❌ Failed to update ${team.team_name}:`, error.message);
      }
    }

    console.log(`\n✅ Seeding complete: Updated ${updated}/${teams.length} teams`);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedTeamLogos().then(() => process.exit(0));
}

module.exports = seedTeamLogos;
