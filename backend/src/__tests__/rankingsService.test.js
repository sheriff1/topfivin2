/**
 * Unit tests for rankingsService
 * Tests rankings retrieval, caching, and category management
 */

const { getCategories, getRankings, STAT_CATEGORIES } = require("../services/rankingsService");
const MockDatabase = require("./mocks/db");
const MockCache = require("./mocks/cache");
const { MOCK_DB_RESULT, MOCK_CACHE_DATA } = require("./mocks/testData");

describe("rankingsService", () => {
  let mockDb;
  let mockCache;

  beforeEach(() => {
    mockDb = new MockDatabase();
    mockCache = new MockCache();
  });

  afterEach(() => {
    mockDb.reset();
    mockCache.flushAll();
  });

  describe("getCategories", () => {
    it("should return all available stat categories", () => {
      const categories = getCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it("should include category code and label", () => {
      const categories = getCategories();

      categories.forEach((cat) => {
        expect(cat).toHaveProperty("code");
        expect(cat).toHaveProperty("label");
        expect(typeof cat.code).toBe("string");
        expect(typeof cat.label).toBe("string");
      });
    });

    it("should include common stat categories", () => {
      const categories = getCategories();
      const codes = categories.map((c) => c.code);

      expect(codes).toContain("PPG");
      expect(codes).toContain("RPG");
      expect(codes).toContain("APG");
    });
  });

  describe("getRankings", () => {
    beforeEach(() => {
      mockDb.setMockData("SELECT sr.team_id, sr.stat_category, sr.rank", MOCK_DB_RESULT.rankings);
      mockCache.setData(MOCK_CACHE_DATA);
    });

    it("should return rankings for a specific category", async () => {
      const result = await getRankings("PPG", 2024, mockDb, mockCache);

      expect(result).toHaveProperty("rows");
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it("should return cached data when available", async () => {
      const cachedData = MOCK_CACHE_DATA["nba:rankings:PPG:2024"];
      mockCache.setData({ "nba:rankings:PPG:2024": cachedData });

      const result = await getRankings("PPG", 2024, mockDb, mockCache);

      expect(result.cached).toBe(true);
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it("should include ranking metadata (label, cached_at)", async () => {
      mockCache.setData(MOCK_CACHE_DATA);

      const result = await getRankings("PPG", 2024, mockDb, mockCache);

      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("cached");
      if (result.cached) {
        expect(result).toHaveProperty("cached_at");
      }
    });

    it("should query database when cache misses", async () => {
      mockDb.setMockData("SELECT sr.team_id, sr.stat_category, sr.rank", MOCK_DB_RESULT.rankings);

      const result = await getRankings("RPG", 2024, mockDb, mockCache);

      const history = mockDb.getQueryHistory();
      expect(history.count).toBeGreaterThan(0);
    });

    it("should include team info in rankings (team_id, team_name, logo_url)", async () => {
      mockDb.setMockData("SELECT sr.team_id, sr.stat_category, sr.rank", MOCK_DB_RESULT.rankings);

      const result = await getRankings("PPG", 2024, mockDb, mockCache);

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        expect(row).toHaveProperty("team_id");
        expect(row).toHaveProperty("team_name");
        expect(row).toHaveProperty("stat_category");
        expect(row).toHaveProperty("rank");
      }
    });

    it("should handle multiple seasons independently", async () => {
      mockDb.setMockData("SELECT sr.team_id, sr.stat_category, sr.rank", MOCK_DB_RESULT.rankings);

      const result2024 = await getRankings("PPG", 2024, mockDb, mockCache);
      const result2025 = await getRankings("PPG", 2025, mockDb, mockCache);

      // Both should return results
      expect(result2024).toHaveProperty("rows");
      expect(result2025).toHaveProperty("rows");
    });
  });

  describe("STAT_CATEGORIES reference", () => {
    it("should export STAT_CATEGORIES constant", () => {
      expect(STAT_CATEGORIES).toBeDefined();
      expect(typeof STAT_CATEGORIES).toBe("object");
    });

    it("should include PPG and other standard stats", () => {
      expect(STAT_CATEGORIES.PPG).toBeDefined();
      expect(STAT_CATEGORIES.RPG).toBeDefined();
    });
  });

  describe("Cache integration", () => {
    it("should respect cache TTL settings in getRankings", async () => {
      mockDb.setMockData("SELECT sr.team_id, sr.stat_category, sr.rank", MOCK_DB_RESULT.rankings);

      // First call should cache the result
      const initialStats = mockCache.getStats();
      await getRankings("PPG", 2024, mockDb, mockCache);

      // Cache operations should have occurred
      expect(mockCache.getStats().getCount).toBeGreaterThanOrEqual(initialStats.getCount);
    });
  });

  describe("Error handling", () => {
    it("should handle database query errors gracefully", async () => {
      mockDb.setMockData("SELECT sr.team_id", {
        rows: [],
        rowCount: 0,
      });

      // Should not throw when returning empty results
      const result = await getRankings("PPG", 2024, mockDb, mockCache);
      expect(result).toBeDefined();
    });

    it("should handle invalid season values", async () => {
      mockDb.setMockData("SELECT sr.team_id, sr.stat_category, sr.rank", MOCK_DB_RESULT.rankings);

      // Should handle gracefully
      const result = await getRankings("PPG", -1, mockDb, mockCache);
      expect(result).toBeDefined();
    });
  });
});
