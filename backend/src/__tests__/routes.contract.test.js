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

const {
  HealthResponseSchema,
  CategoriesResponseSchema,
  RankingsResponseSchema,
  TeamsResponseSchema,
  TeamByAbbrResponseSchema,
  TeamStatsResponseSchema,
  TeamRankingsResponseSchema,
  AuditGamesResponseSchema,
  AuditGameStatsResponseSchema,
} = require("../schemas/responseSchemas");

beforeEach(() => {
  jest.clearAllMocks();
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue("OK");
});

// Helper to run a Zod parse and surface detailed errors on failure
function assertSchema(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    // Jest will print this in the failure output for easy debugging
    throw new Error(`Schema validation failed:\n${JSON.stringify(result.error.format(), null, 2)}`);
  }
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
describe("GET /health — contract", () => {
  it("response matches HealthResponseSchema", async () => {
    const res = await request(app).get("/health");
    assertSchema(HealthResponseSchema, res.body);
  });
});

// ---------------------------------------------------------------------------
// GET /api/categories
// ---------------------------------------------------------------------------
describe("GET /api/categories — contract", () => {
  it("response matches CategoriesResponseSchema", async () => {
    const res = await request(app).get("/api/categories");
    assertSchema(CategoriesResponseSchema, res.body);
  });
});

// ---------------------------------------------------------------------------
// GET /api/rankings
// ---------------------------------------------------------------------------
describe("GET /api/rankings — contract", () => {
  it("response matches RankingsResponseSchema (cache miss)", async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          team_id: 1610612751,
          team_name: "Brooklyn Nets",
          stat_category: "PPG",
          rank: 1,
          value: 115.4,
          logo_url: null,
          games_count: 82,
        },
      ],
      rowCount: 1,
    });

    const res = await request(app).get("/api/rankings?category=PPG");
    assertSchema(RankingsResponseSchema, res.body);
  });
});

// ---------------------------------------------------------------------------
// GET /api/teams
// ---------------------------------------------------------------------------
describe("GET /api/teams — contract", () => {
  it("response matches TeamsResponseSchema", async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          team_id: 1610612751,
          team_name: "Brooklyn Nets",
          logo_url: null,
          team_colors: null,
        },
      ],
      rowCount: 1,
    });

    const res = await request(app).get("/api/teams");
    assertSchema(TeamsResponseSchema, res.body);
  });
});

// ---------------------------------------------------------------------------
// GET /api/teams/abbr/:abbreviation
// ---------------------------------------------------------------------------
describe("GET /api/teams/abbr/:abbreviation — contract", () => {
  it("response matches TeamByAbbrResponseSchema", async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          team_id: 1610612738,
          team_name: "Boston Celtics",
          logo_url: null,
          team_colors: null,
        },
      ],
      rowCount: 1,
    });

    const res = await request(app).get("/api/teams/abbr/BOS");
    assertSchema(TeamByAbbrResponseSchema, res.body);
  });
});

// ---------------------------------------------------------------------------
// GET /api/team/:teamId/stats
// ---------------------------------------------------------------------------
describe("GET /api/team/:teamId/stats — contract", () => {
  it("response matches TeamStatsResponseSchema", async () => {
    db.query.mockResolvedValue({
      rows: [
        {
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
        },
      ],
      rowCount: 1,
    });

    const res = await request(app).get("/api/team/1610612751/stats");
    assertSchema(TeamStatsResponseSchema, res.body);
  });
});

// ---------------------------------------------------------------------------
// GET /api/team/:teamId/rankings
// ---------------------------------------------------------------------------
describe("GET /api/team/:teamId/rankings — contract", () => {
  it("response matches TeamRankingsResponseSchema", async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          team_id: 1610612751,
          team_name: "Brooklyn Nets",
          stat_category: "PPG",
          rank: 4,
          value: 115.4,
        },
      ],
      rowCount: 1,
    });

    const res = await request(app).get("/api/team/1610612751/rankings");
    assertSchema(TeamRankingsResponseSchema, res.body);
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit/games
// ---------------------------------------------------------------------------
describe("GET /api/audit/games — contract", () => {
  it("response matches AuditGamesResponseSchema", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          { season: "2025", total_games: 100, collected_games: 80, collection_percentage: "80.00" },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            game_id: "g1",
            game_date: "2024-01-01",
            home_team_id: 1610612738,
            home_team_abbreviation: "BOS",
            home_team_logo: null,
            away_team_id: 1610612747,
            away_team_abbreviation: "LAL",
            away_team_logo: null,
            collected: true,
            created_at: "2024-01-01T00:00:00.000Z",
            updated_at: "2024-01-01T00:00:00.000Z",
          },
        ],
        rowCount: 1,
      });

    const res = await request(app).get("/api/audit/games");
    assertSchema(AuditGamesResponseSchema, res.body);
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit/game/:gameId/stats
// ---------------------------------------------------------------------------
describe("GET /api/audit/game/:gameId/stats — contract", () => {
  it("response matches AuditGameStatsResponseSchema (percentages are numbers)", async () => {
    db.query.mockResolvedValue({
      rows: [
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
          // node-postgres returns NUMERIC as strings — service normalizes to number
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
      ],
      rowCount: 2,
    });

    const res = await request(app).get("/api/audit/game/g1/stats");
    assertSchema(AuditGameStatsResponseSchema, res.body);
  });
});
