const db = require("../src/db/postgresClient");

const schema = `
-- Teams table (30 unique teams, no season duplication)
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  team_id INT UNIQUE NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  abbreviation VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table (tracks games and their collection status)
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(50) UNIQUE NOT NULL,
  game_date DATE NOT NULL,
  home_team_id INT,
  away_team_id INT,
  season VARCHAR(10) NOT NULL,
  collected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (home_team_id) REFERENCES teams(team_id) ON DELETE SET NULL,
  FOREIGN KEY (away_team_id) REFERENCES teams(team_id) ON DELETE SET NULL
);

-- Game stats table (per-team stats for each game)
CREATE TABLE IF NOT EXISTS game_stats (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(50) NOT NULL,
  team_id INT NOT NULL,
  game_date DATE NOT NULL,
  season VARCHAR(10) NOT NULL,
  
  -- Basic counting stats
  games_played INT DEFAULT 1,
  
  -- Field goals
  fg INT,
  fga INT,
  fg_pct FLOAT,
  
  -- 3-pointers  
  three_p INT,
  three_pa INT,
  three_p_pct FLOAT,
  
  -- Free throws
  ft INT,
  fta INT,
  ft_pct FLOAT,
  
  -- Rebounds
  oreb INT,
  dreb INT,
  reb INT,
  
  -- Other stats
  ast INT,
  tov INT,
  stl INT,
  blk INT,
  pf INT,
  pts INT,
  
  -- Advanced (if available)
  plus_minus FLOAT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  UNIQUE(game_id, team_id)
);

-- Team stats table (aggregated team stats per season)
CREATE TABLE IF NOT EXISTS team_stats (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL,
  season VARCHAR(10) NOT NULL,
  
  -- Aggregated basic stats
  games_played INT DEFAULT 0,
  
  -- Field goals
  fg INT DEFAULT 0,
  fga INT DEFAULT 0,
  fg_pct FLOAT DEFAULT 0,
  
  -- 3-pointers
  three_p INT DEFAULT 0,
  three_pa INT DEFAULT 0,
  three_p_pct FLOAT DEFAULT 0,
  
  -- Free throws
  ft INT DEFAULT 0,
  fta INT DEFAULT 0,
  ft_pct FLOAT DEFAULT 0,
  
  -- Rebounds
  oreb INT DEFAULT 0,
  dreb INT DEFAULT 0,
  reb INT DEFAULT 0,
  
  -- Per-game averages
  fg_avg FLOAT DEFAULT 0,
  fga_avg FLOAT DEFAULT 0,
  three_p_avg FLOAT DEFAULT 0,
  reb_avg FLOAT DEFAULT 0,
  ast_avg FLOAT DEFAULT 0,
  tov_avg FLOAT DEFAULT 0,
  stl_avg FLOAT DEFAULT 0,
  blk_avg FLOAT DEFAULT 0,
  pts_avg FLOAT DEFAULT 0,
  
  -- Total stats
  ast INT DEFAULT 0,
  tov INT DEFAULT 0,
  stl INT DEFAULT 0,
  blk INT DEFAULT 0,
  pf INT DEFAULT 0,
  pts INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  UNIQUE(team_id, season)
);

-- Stat rankings table (rankings derived from team_stats)
CREATE TABLE IF NOT EXISTS stat_rankings (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL,
  stat_category VARCHAR(50) NOT NULL,
  rank INT NOT NULL,
  value FLOAT NOT NULL,
  season VARCHAR(10) NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  UNIQUE(team_id, stat_category, season)
);

-- Audit log table (event tracking)
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  event_details TEXT,
  affected_table VARCHAR(100),
  affected_rows INT,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh logs table (data fetch operation tracking)
CREATE TABLE IF NOT EXISTS refresh_logs (
  id SERIAL PRIMARY KEY,
  status VARCHAR(50) NOT NULL,
  operation_type VARCHAR(100),
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  error_message TEXT,
  records_processed INT,
  records_succeeded INT,
  records_failed INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_teams_team_id ON teams(team_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_team_id ON game_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_game_date ON game_stats(game_date);
CREATE INDEX IF NOT EXISTS idx_game_stats_season ON game_stats(season);
CREATE INDEX IF NOT EXISTS idx_game_stats_game_id ON game_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_team_stats_team_id ON team_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_team_stats_season ON team_stats(season);
CREATE INDEX IF NOT EXISTS idx_stat_rankings_category ON stat_rankings(stat_category);
CREATE INDEX IF NOT EXISTS idx_stat_rankings_team_id ON stat_rankings(team_id);
CREATE INDEX IF NOT EXISTS idx_stat_rankings_season ON stat_rankings(season);
CREATE INDEX IF NOT EXISTS idx_games_game_id ON games(game_id);
CREATE INDEX IF NOT EXISTS idx_games_game_date ON games(game_date);
CREATE INDEX IF NOT EXISTS idx_games_season ON games(season);
CREATE INDEX IF NOT EXISTS idx_games_collected ON games(collected);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_executed_at ON audit_log(executed_at);
CREATE INDEX IF NOT EXISTS idx_refresh_logs_status ON refresh_logs(status);
CREATE INDEX IF NOT EXISTS idx_refresh_logs_completed_at ON refresh_logs(completed_at);
`;

async function runMigrations() {
  try {
    console.log("Running database migrations...");

    // Execute the schema creation
    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await db.query(statement);
    }

    console.log("✓ Database migrations completed successfully");
  } catch (error) {
    console.error("✗ Database migration failed:", error.message);
    throw error;
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("Migrations complete. Exiting.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration error:", error);
      process.exit(1);
    });
}

module.exports = { runMigrations };
