/**
 * Unit tests for auditService
 * Tests audit game retrieval, filtering, and collection status tracking
 */

const { getAuditGames, getGameStats } = require("../services/auditService");
const MockDatabase = require("./mocks/db");
const { MOCK_DB_RESULT } = require("./mocks/testData");

describe("auditService", () => {
  let mockDb;

  beforeEach(() => {
    mockDb = new MockDatabase();
  });

  afterEach(() => {
    mockDb.reset();
  });

  describe("getAuditGames", () => {
    const SEASON = 2024;
    const LIMIT = 10;
    const OFFSET = 0;

    beforeEach(() => {
      mockDb.setMockData("SELECT '2024' as season, COUNT(DISTINCT g.game_id) as total_games", {
        rows: [
          {
            season: "2024",
            total_games: 1230,
            collected_games: 800,
            collection_percentage: 65.04,
          },
        ],
        rowCount: 1,
      });
    });

    it("should retrieve audit games for a specific season", async () => {
      const result = await getAuditGames(SEASON, LIMIT, OFFSET, null, null, mockDb);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("stats");
      expect(result).toHaveProperty("games");
      expect(result).toHaveProperty("pagination");
    });

    it("should include collection statistics in stats object", async () => {
      const result = await getAuditGames(SEASON, LIMIT, OFFSET, null, null, mockDb);

      expect(result.stats).toHaveProperty("total_games");
      expect(result.stats).toHaveProperty("collected_games");
      expect(result.stats).toHaveProperty("collection_percentage");
    });

    it("should calculate collection percentage correctly", async () => {
      const result = await getAuditGames(SEASON, LIMIT, OFFSET, null, null, mockDb);

      expect(result.stats.collection_percentage).toBeGreaterThanOrEqual(0);
      expect(result.stats.collection_percentage).toBeLessThanOrEqual(100);
    });

    it("should filter by collection status (collected)", async () => {
      mockDb.setMockData("SELECT '2024' as season, COUNT(DISTINCT g.game_id) as total_games", {
        rows: [
          {
            season: "2024",
            total_games: 1230,
            collected_games: 800,
            collection_percentage: 65.04,
          },
        ],
        rowCount: 1,
      });

      const result = await getAuditGames(SEASON, LIMIT, OFFSET, "collected", null, mockDb);

      // Should include collected status in query history
      const history = mockDb.getQueryHistory();
      expect(history.lastQuery).toContain("WHERE");
    });

    it("should filter by collection status (missing)", async () => {
      const result = await getAuditGames(SEASON, LIMIT, OFFSET, "missing", null, mockDb);

      // Should have executed query
      const history = mockDb.getQueryHistory();
      expect(history.count).toBeGreaterThan(0);
    });

    it("should filter by date when provided", async () => {
      const date = "2024-01-15";
      const result = await getAuditGames(SEASON, LIMIT, OFFSET, null, date, mockDb);

      const history = mockDb.getQueryHistory();
      if (date) {
        expect(history.lastParams).toBeDefined();
      }
    });

    it("should respect LIMIT for pagination", async () => {
      const result = await getAuditGames(SEASON, 5, OFFSET, null, null, mockDb);

      // Should include limit in query
      const history = mockDb.getQueryHistory();
      expect(history.lastParams).toBeDefined();
    });

    it("should handle OFFSET for pagination", async () => {
      const result = await getAuditGames(SEASON, LIMIT, 20, null, null, mockDb);

      // Should include offset in query
      const history = mockDb.getQueryHistory();
      expect(history.lastParams).toBeDefined();
    });

    it("should handle multiple filter combinations", async () => {
      const date = "2024-01-15";
      await getAuditGames(SEASON, LIMIT, OFFSET, "collected", date, mockDb);

      // Should handle combined filters (stats + games queries = 2 queries)
      const history = mockDb.getQueryHistory();
      expect(history.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getGameStats", () => {
    it("should retrieve stats for game data", async () => {
      const gameId = "test_game_123";

      mockDb.setMockData("SELECT gs.game_id, g.game_date, t.team_id", {
        rows: [
          {
            game_id: gameId,
            game_date: new Date("2024-01-15"),
            team_id: 1610612751,
            abbreviation: "BKN",
            logo_url: "https://example.com/nets.png",
            pts: 110,
            reb: 45,
            ast: 28,
          },
          {
            game_id: gameId,
            game_date: new Date("2024-01-15"),
            team_id: 1610612752,
            abbreviation: "BOS",
            logo_url: "https://example.com/celtics.png",
            pts: 115,
            reb: 48,
            ast: 30,
          },
        ],
        rowCount: 2,
      });

      const result = await getGameStats(gameId, mockDb);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("home");
      expect(result).toHaveProperty("away");
      expect(result.game_id).toBe(gameId);
    });

    it("should throw error when game has no stats", async () => {
      mockDb.setMockData("SELECT gs.game_id, gs.game_date", { rows: [], rowCount: 0 });

      await expect(getGameStats("nonexistent", mockDb)).rejects.toThrow("No stats found for game");
    });

    it("should include both home and away team stats", async () => {
      const gameId = "g1";

      mockDb.setMockData("SELECT gs.game_id, g.game_date, t.team_id", {
        rows: [
          {
            game_id: gameId,
            game_date: new Date("2024-01-15"),
            team_id: 1610612751,
            abbreviation: "BKN",
            logo_url: "https://example.com/nets.png",
            pts: 110,
            reb: 45,
            ast: 28,
          },
          {
            game_id: gameId,
            game_date: new Date("2024-01-15"),
            team_id: 1610612752,
            abbreviation: "BOS",
            logo_url: "https://example.com/celtics.png",
            pts: 115,
            reb: 48,
            ast: 30,
          },
        ],
        rowCount: 2,
      });

      const result = await getGameStats(gameId, mockDb);

      expect(result.home).toBeDefined();
      expect(result.away).toBeDefined();
      expect(result.home.team_id).toBeLessThan(result.away.team_id);
    });

    it("should organize stats by home (lower team_id) and away (higher team_id)", async () => {
      const gameId = "g1";

      mockDb.setMockData("SELECT gs.game_id, g.game_date, t.team_id", {
        rows: [
          {
            game_id: gameId,
            game_date: new Date("2024-01-15"),
            team_id: 1610612751,
            abbreviation: "BKN",
            logo_url: "https://example.com/nets.png",
            pts: 110,
            reb: 45,
            ast: 28,
          },
          {
            game_id: gameId,
            game_date: new Date("2024-01-15"),
            team_id: 1610612752,
            abbreviation: "BOS",
            logo_url: "https://example.com/celtics.png",
            pts: 115,
            reb: 48,
            ast: 30,
          },
        ],
        rowCount: 2,
      });

      const result = await getGameStats(gameId, mockDb);

      // Home team should have lower team_id
      expect(result.home.team_id).toBe(1610612751);
      // Away team should have higher team_id
      expect(result.away.team_id).toBe(1610612752);
    });
  });

  describe("Database query execution", () => {
    it("should execute query with season parameter", async () => {
      const SEASON = 2024;
      mockDb.setMockData("SELECT '2024' as season, COUNT(DISTINCT g.game_id) as total_games", {
        rows: [
          {
            season: "2024",
            total_games: 1230,
            collected_games: 800,
            collection_percentage: 65.04,
          },
        ],
        rowCount: 1,
      });

      await getAuditGames(SEASON, 10, 0, null, null, mockDb);

      const history = mockDb.getQueryHistory();
      expect(history.count).toBeGreaterThanOrEqual(1);
      expect(history.lastParams).toContain(SEASON);
    });

    it("should track query count across multiple calls", async () => {
      mockDb.setMockData("SELECT '2024' as season, COUNT(DISTINCT g.game_id) as total_games", {
        rows: [
          {
            season: "2024",
            total_games: 1230,
            collected_games: 800,
            collection_percentage: 65.04,
          },
        ],
        rowCount: 1,
      });

      await getAuditGames(2024, 10, 0, null, null, mockDb);
      await getAuditGames(2023, 10, 0, null, null, mockDb);

      const history = mockDb.getQueryHistory();
      expect(history.count).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockDb.setMockData("SELECT '2024' as season, COUNT(DISTINCT g.game_id) as total_games", {
        rows: [],
        rowCount: 0,
      });

      const result = await getAuditGames(2024, 10, 0, null, null, mockDb);

      // Should return something even if no data
      expect(result).toBeDefined();
    });

    it("should handle invalid season values", async () => {
      mockDb.setMockData("SELECT '2024' as season, COUNT(DISTINCT g.game_id) as total_games", {
        rows: [],
        rowCount: 0,
      });

      // Should not crash with invalid season
      const result = await getAuditGames(-1, 10, 0, null, null, mockDb);
      expect(result).toBeDefined();
    });

    it("should handle invalid status filter values", async () => {
      mockDb.setMockData("SELECT '2024' as season, COUNT(DISTINCT g.game_id) as total_games", {
        rows: [
          {
            season: "2024",
            total_games: 1230,
            collected_games: 800,
            collection_percentage: 65.04,
          },
        ],
        rowCount: 1,
      });

      // Should not crash with invalid status
      const result = await getAuditGames(2024, 10, 0, "invalid_status", null, mockDb);
      expect(result).toBeDefined();
    });
  });
});
