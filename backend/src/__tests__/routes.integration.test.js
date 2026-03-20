const request = require("supertest");

// Mock db and cache BEFORE importing app so route modules get the mocked versions
jest.mock("../db/postgresClient", () => ({
  query: jest.fn(),
  pool: { end: jest.fn() },
}));

jest.mock("../cache/redisClient", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  redis: { quit: jest.fn() },
}));

// Bypass rate limiting in tests
jest.mock("../middleware/rateLimiter", () => ({
  apiLimiter: (req, res, next) => next(),
  rankingsLimiter: (req, res, next) => next(),
  teamStatsLimiter: (req, res, next) => next(),
}));

const app = require("../app");
const db = require("../db/postgresClient");
const cache = require("../cache/redisClient");

beforeEach(() => {
  jest.clearAllMocks();
  // Default: cache returns null (cache miss) so rankings hit the db
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue("OK");
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
describe("GET /health", () => {
  it("returns healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body.api).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// GET /api/categories
// ---------------------------------------------------------------------------
describe("GET /api/categories", () => {
  it("returns list of stat categories", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.categories.length).toBeGreaterThan(0);
    expect(res.body.categories[0]).toHaveProperty("code");
    expect(res.body.categories[0]).toHaveProperty("label");
  });
});

// ---------------------------------------------------------------------------
// GET /api/rankings
// ---------------------------------------------------------------------------
describe("GET /api/rankings", () => {
  const mockRankingsRows = [
    {
      team_id: 1610612751,
      team_name: "Brooklyn Nets",
      stat_category: "PPG",
      rank: 1,
      value: 115.4,
      logo_url: null,
      games_count: 82,
    },
    {
      team_id: 1610612752,
      team_name: "Boston Celtics",
      stat_category: "PPG",
      rank: 2,
      value: 113.2,
      logo_url: null,
      games_count: 82,
    },
  ];

  it("returns rankings for a valid category (cache miss)", async () => {
    db.query.mockResolvedValue({ rows: mockRankingsRows, rowCount: 2 });

    const res = await request(app).get("/api/rankings?category=PPG");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.category).toBe("PPG");
    expect(res.body.cached).toBe(false);
    expect(Array.isArray(res.body.rankings)).toBe(true);
    expect(res.body.rankings).toHaveLength(2);
    expect(res.body).toHaveProperty("fetched_at");
  });

  it("returns cached rankings on cache hit", async () => {
    cache.get.mockResolvedValue({
      rankings: mockRankingsRows,
      label: "Points Per Game",
      cached_at: "2026-01-01T00:00:00.000Z",
    });

    const res = await request(app).get("/api/rankings?category=PPG");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cached).toBe(true);
    expect(res.body).toHaveProperty("cached_at");
    expect(db.query).not.toHaveBeenCalled();
  });

  it("returns 400 when category is missing", async () => {
    const res = await request(app).get("/api/rankings");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for an invalid category value", async () => {
    const res = await request(app).get("/api/rankings?category=INVALID");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for an invalid season format", async () => {
    const res = await request(app).get("/api/rankings?category=PPG&season=bad");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 when no rankings exist for the category", async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app).get("/api/rankings?category=PPG");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 500 on database error", async () => {
    db.query.mockRejectedValue(new Error("DB connection failed"));

    const res = await request(app).get("/api/rankings?category=PPG");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/teams
// ---------------------------------------------------------------------------
describe("GET /api/teams", () => {
  const mockTeamRows = [
    { id: 1, team_id: 1610612751, team_name: "Brooklyn Nets", logo_url: null, team_colors: null },
    { id: 2, team_id: 1610612752, team_name: "Boston Celtics", logo_url: null, team_colors: null },
  ];

  it("returns all teams", async () => {
    db.query.mockResolvedValue({ rows: mockTeamRows, rowCount: 2 });

    const res = await request(app).get("/api/teams");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it("filters by team_id query parameter", async () => {
    db.query.mockResolvedValue({ rows: [mockTeamRows[0]], rowCount: 1 });

    const res = await request(app).get("/api/teams?team_id=1610612751");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].team_id).toBe(1610612751);
  });

  it("returns 400 for non-integer team_id", async () => {
    const res = await request(app).get("/api/teams?team_id=abc");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 500 on database error", async () => {
    db.query.mockRejectedValue(new Error("DB error"));

    const res = await request(app).get("/api/teams");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/teams/abbr/:abbreviation
// ---------------------------------------------------------------------------
describe("GET /api/teams/abbr/:abbreviation", () => {
  const mockTeamRow = {
    id: 1,
    team_id: 1610612738,
    team_name: "Boston Celtics",
    logo_url: null,
    team_colors: null,
  };

  it("returns team by valid abbreviation", async () => {
    db.query.mockResolvedValue({ rows: [mockTeamRow], rowCount: 1 });

    const res = await request(app).get("/api/teams/abbr/BOS");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("team_id");
  });

  it("returns 400 for abbreviation that is not exactly 3 letters", async () => {
    const res = await request(app).get("/api/teams/abbr/BOST");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for unknown abbreviation", async () => {
    const res = await request(app).get("/api/teams/abbr/ZZZ");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 when team not found in database", async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });

    // Use a valid abbreviation that exists in TEAM_ABBR_TO_ID
    const res = await request(app).get("/api/teams/abbr/BOS");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/team/:teamId/stats
// ---------------------------------------------------------------------------
describe("GET /api/team/:teamId/stats", () => {
  const mockStatsRow = {
    team_id: 1610612751,
    team_name: "Brooklyn Nets",
    season: 2024,
    games_played: 82,
    fg: 1568,
    fga: 3350,
    fg_pct: 0.468,
    three_p: 600,
    three_pa: 1600,
    three_p_pct: 0.375,
    ft: 400,
    fta: 500,
    ft_pct: 0.8,
    oreb: 400,
    dreb: 1000,
    reb: 1400,
    ast: 2337,
    tov: 900,
    stl: 500,
    blk: 300,
    pf: 1200,
    pts: 9462,
    fg_avg: 19.1,
    fga_avg: 40.9,
    three_p_avg: 7.3,
    reb_avg: 17.1,
    ast_avg: 28.5,
    tov_avg: 11.0,
    stl_avg: 6.1,
    blk_avg: 3.7,
    pts_avg: 115.4,
    orb_pct: null,
    drb_pct: null,
    trb_pct: null,
    ast_pct: null,
    tov_pct: null,
    usg_pct: null,
    ts_pct: null,
  };

  it("returns stats for a valid team", async () => {
    db.query.mockResolvedValue({ rows: [mockStatsRow], rowCount: 1 });

    const res = await request(app).get("/api/team/1610612751/stats");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("team_id");
    expect(res.body.data).toHaveProperty("stats");
  });

  it("returns 400 for non-integer teamId", async () => {
    const res = await request(app).get("/api/team/abc/stats");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 when no stats found for team", async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app).get("/api/team/9999999/stats");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 500 on database error", async () => {
    db.query.mockRejectedValue(new Error("DB error"));

    const res = await request(app).get("/api/team/1610612751/stats");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/team/:teamId/rankings
// ---------------------------------------------------------------------------
describe("GET /api/team/:teamId/rankings", () => {
  const mockRankingsRow = {
    team_id: 1610612751,
    team_name: "Brooklyn Nets",
    stat_category: "PPG",
    rank: 4,
    value: 115.4,
  };

  it("returns rankings for a valid team", async () => {
    db.query.mockResolvedValue({ rows: [mockRankingsRow], rowCount: 1 });

    const res = await request(app).get("/api/team/1610612751/rankings");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("rankings");
    expect(Array.isArray(res.body.data.rankings)).toBe(true);
  });

  it("returns 400 for non-integer teamId", async () => {
    const res = await request(app).get("/api/team/abc/rankings");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 when no rankings found for team", async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app).get("/api/team/9999999/rankings");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 500 on database error", async () => {
    db.query.mockRejectedValue(new Error("DB error"));

    const res = await request(app).get("/api/team/1610612751/rankings");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit/games
// ---------------------------------------------------------------------------
describe("GET /api/audit/games", () => {
  const mockStatsResult = {
    rows: [
      { season: "2025", total_games: 100, collected_games: 80, collection_percentage: "80.00" },
    ],
    rowCount: 1,
  };
  const mockGamesResult = {
    rows: [
      {
        game_id: "g1",
        game_date: "2024-01-01",
        home_team_abbreviation: "BOS",
        away_team_abbreviation: "LAL",
        collected: true,
      },
    ],
    rowCount: 1,
  };

  it("returns audit data with stats and games", async () => {
    // auditService runs 2 queries in parallel via Promise.all
    db.query.mockResolvedValueOnce(mockStatsResult).mockResolvedValueOnce(mockGamesResult);

    const res = await request(app).get("/api/audit/games");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("stats");
    expect(res.body).toHaveProperty("games");
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.stats).toHaveProperty("total_games");
  });

  it("returns 400 for invalid status value", async () => {
    const res = await request(app).get("/api/audit/games?status=invalid");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for invalid date format", async () => {
    const res = await request(app).get("/api/audit/games?date=not-a-date");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for limit out of range", async () => {
    const res = await request(app).get("/api/audit/games?limit=999");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 500 on database error", async () => {
    db.query.mockRejectedValue(new Error("DB error"));

    const res = await request(app).get("/api/audit/games");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit/game/:gameId/stats
// ---------------------------------------------------------------------------
describe("GET /api/audit/game/:gameId/stats", () => {
  const mockGameRows = [
    {
      game_id: "g1",
      game_date: "2024-01-01",
      team_id: 1610612738,
      abbreviation: "BOS",
      logo_url: null,
      pts: 110,
      reb: 45,
      ast: 25,
      stl: 8,
      blk: 5,
      fg_pct: "46.00",
      ft_pct: "78.00",
      three_p_pct: "37.00",
      fg: 40,
      fga: 87,
      ft: 18,
      fta: 23,
      three_p: 12,
      three_pa: 32,
    },
    {
      game_id: "g1",
      game_date: "2024-01-01",
      team_id: 1610612747,
      abbreviation: "LAL",
      logo_url: null,
      pts: 105,
      reb: 42,
      ast: 22,
      stl: 6,
      blk: 4,
      fg_pct: "44.00",
      ft_pct: "75.00",
      three_p_pct: "35.00",
      fg: 38,
      fga: 86,
      ft: 15,
      fta: 20,
      three_p: 10,
      three_pa: 28,
    },
  ];

  it("returns home and away stats for a valid game", async () => {
    db.query.mockResolvedValue({ rows: mockGameRows, rowCount: 2 });

    const res = await request(app).get("/api/audit/game/g1/stats");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("home");
    expect(res.body.data).toHaveProperty("away");
    expect(res.body.data).toHaveProperty("game_id");
    expect(res.body.data).toHaveProperty("game_date");
  });

  it("returns 400 for gameId exceeding max length", async () => {
    const longId = "a".repeat(51);
    const res = await request(app).get(`/api/audit/game/${longId}/stats`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 500 when game is not found (service throws)", async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app).get("/api/audit/game/nonexistent/stats");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it("returns 500 on database error", async () => {
    db.query.mockRejectedValue(new Error("DB error"));

    const res = await request(app).get("/api/audit/game/g1/stats");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
