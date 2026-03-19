/**
 * Test data fixtures for backend services
 * Reusable mock data for unit and integration tests
 */

const MOCK_TEAM_STATS = [
  {
    id: 1610612751,
    name: "Brooklyn Nets",
    PPG: 115.4,
    RPG: 44.2,
    APG: 28.5,
    "FG%": 46.8,
    "3P%": 37.2,
    "FT%": 78.3,
    SPG: 7.1,
    BPG: 5.2,
  },
  {
    id: 1610612752,
    name: "Boston Celtics",
    PPG: 118.2,
    RPG: 46.1,
    APG: 27.8,
    "FG%": 48.5,
    "3P%": 38.9,
    "FT%": 79.1,
    SPG: 7.8,
    BPG: 5.9,
  },
  {
    id: 1610612761,
    name: "Chicago Bulls",
    PPG: 112.3,
    RPG: 43.5,
    APG: 26.2,
    "FG%": 45.7,
    "3P%": 36.1,
    "FT%": 77.5,
    SPG: 6.9,
    BPG: 4.8,
  },
  {
    id: 1610612762,
    name: "Cleveland Cavaliers",
    PPG: 116.8,
    RPG: 45.3,
    APG: 28.1,
    "FG%": 47.2,
    "3P%": 37.8,
    "FT%": 78.9,
    SPG: 7.4,
    BPG: 5.5,
  },
  {
    id: 1610612763,
    name: "Dallas Mavericks",
    PPG: 119.1,
    RPG: 45.8,
    APG: 29.3,
    "FG%": 48.1,
    "3P%": 38.2,
    "FT%": 79.3,
    SPG: 7.5,
    BPG: 5.1,
  },
];

const MOCK_TEAM_RANKINGS = {
  PPG: [
    { team_id: 1610612763, team_name: "Dallas Mavericks", rank: 1, value: 119.1 },
    { team_id: 1610612752, team_name: "Boston Celtics", rank: 2, value: 118.2 },
    { team_id: 1610612762, team_name: "Cleveland Cavaliers", rank: 3, value: 116.8 },
    { team_id: 1610612751, team_name: "Brooklyn Nets", rank: 4, value: 115.4 },
    { team_id: 1610612761, team_name: "Chicago Bulls", rank: 5, value: 112.3 },
  ],
  RPG: [
    { team_id: 1610612752, team_name: "Boston Celtics", rank: 1, value: 46.1 },
    { team_id: 1610612763, team_name: "Dallas Mavericks", rank: 2, value: 45.8 },
    { team_id: 1610612762, team_name: "Cleveland Cavaliers", rank: 3, value: 45.3 },
    { team_id: 1610612761, team_name: "Chicago Bulls", rank: 4, value: 43.5 },
    { team_id: 1610612751, team_name: "Brooklyn Nets", rank: 5, value: 44.2 },
  ],
};

const MOCK_DB_RESULT = {
  team_stats: {
    rows: [
      {
        team_id: 1610612751,
        team_name: "Brooklyn Nets",
        season: 2024,
        games_played: 82,
        fg: 1568,
        fga: 3350,
        fg_pct: 0.468,
        ast: 2337,
        pts: 9462,
        pts_avg: 115.4,
      },
    ],
    rowCount: 1,
  },
  games: {
    rows: [
      {
        game_id: "g1",
        season: 2024,
        game_date: new Date("2024-01-01"),
      },
    ],
    rowCount: 1,
  },
  rankings: {
    rows: [
      {
        team_id: 1610612751,
        team_name: "Brooklyn Nets",
        stat_category: "PPG",
        rank: 1,
        value: 115.4,
        logo_url: "https://example.com/nets.png",
      },
    ],
    rowCount: 1,
  },
};

const MOCK_CACHE_DATA = {
  "nba:rankings:PPG:2024": {
    rankings: MOCK_TEAM_RANKINGS.PPG,
    label: "Points Per Game",
    cached_at: new Date().toISOString(),
  },
  "nba:team:1610612751:stats:2024": {
    team_id: 1610612751,
    team_name: "Brooklyn Nets",
    stats: MOCK_TEAM_STATS[0],
  },
};

module.exports = {
  MOCK_TEAM_STATS,
  MOCK_TEAM_RANKINGS,
  MOCK_DB_RESULT,
  MOCK_CACHE_DATA,
};
