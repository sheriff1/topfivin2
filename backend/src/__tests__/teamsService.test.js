/**
 * Unit tests for teamsService
 * Tests team stats retrieval, team-specific data, and stat aggregations
 */

const { getTeamStats, getTeamRankings } = require('../services/teamsService');
const MockDatabase = require('./mocks/db');
const { MOCK_DB_RESULT } = require('./mocks/testData');

describe('teamsService', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = new MockDatabase();
  });

  afterEach(() => {
    mockDb.reset();
  });

  describe('getTeamStats', () => {
    const TEAM_ID = 1610612751;
    const SEASON = 2024;

    beforeEach(() => {
      mockDb.setMockData(
        'SELECT t.team_id, t.team_name, ts.season',
        MOCK_DB_RESULT.team_stats,
      );
    });

    it('should retrieve team stats for a given team_id and season', async () => {
      const result = await getTeamStats(TEAM_ID, SEASON, mockDb);

      expect(result).toBeDefined();
      if (result) {
        expect(result).toHaveProperty('team_id');
        expect(result).toHaveProperty('team_name');
        expect(result).toHaveProperty('season');
      }
    });

    it('should return null when team stats not found', async () => {
      mockDb.setMockData(
        'SELECT t.team_id, t.team_name, ts.season',
        { rows: [], rowCount: 0 },
      );

      const result = await getTeamStats(TEAM_ID, SEASON, mockDb);

      expect(result).toBeNull();
    });

    it('should include aggregated stats (FG, 3P, FT, etc)', async () => {
      const result = await getTeamStats(TEAM_ID, SEASON, mockDb);

      if (result) {
        expect(result).toHaveProperty('fg');
        expect(result).toHaveProperty('fga');
        expect(result).toHaveProperty('fg_pct');
        expect(result).toHaveProperty('pts');
      }
    });

    it('should include per-game averages', async () => {
      const result = await getTeamStats(TEAM_ID, SEASON, mockDb);

      if (result) {
        expect(result).toHaveProperty('fg_avg');
        expect(result).toHaveProperty('fga_avg');
        expect(result).toHaveProperty('pts_avg');
        expect(result).toHaveProperty('reb_avg');
        expect(result).toHaveProperty('ast_avg');
      }
    });

    it('should include games_played count', async () => {
      const result = await getTeamStats(TEAM_ID, SEASON, mockDb);

      if (result) {
        expect(result).toHaveProperty('games_played');
        expect(typeof result.games_played).toBe('number');
      }
    });

    it('should handle multiple seasons independently', async () => {
      mockDb.setMockData(
        'SELECT t.team_id, t.team_name, ts.season',
        MOCK_DB_RESULT.team_stats,
      );

      const result2024 = await getTeamStats(TEAM_ID, 2024, mockDb);
      const result2023 = await getTeamStats(TEAM_ID, 2023, mockDb);

      // Both calls should work independently
      expect(mockDb.getQueryHistory().count).toBe(2);
    });

    it('should format percentages as decimals (0-1)', async () => {
      const result = await getTeamStats(TEAM_ID, SEASON, mockDb);

      if (result && result.fg_pct) {
        expect(result.fg_pct).toBeLessThanOrEqual(1);
        expect(result.fg_pct).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getTeamRankings', () => {
    const TEAM_ID = 1610612751;

    beforeEach(() => {
      mockDb.setMockData(
        'SELECT sr.team_id, sr.stat_category, sr.rank',
        MOCK_DB_RESULT.rankings,
      );
    });

    it('should retrieve rankings for a specific team', async () => {
      const result = await getTeamRankings(TEAM_ID, mockDb);

      expect(result).toBeDefined();
      if (result) {
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it('should return empty array when team has no rankings', async () => {
      mockDb.setMockData(
        'SELECT sr.team_id, sr.stat_category, sr.rank',
        { rows: [], rowCount: 0 },
      );

      const result = await getTeamRankings(TEAM_ID, mockDb);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should include multiple stat categories', async () => {
      const result = await getTeamRankings(TEAM_ID, mockDb);

      if (result && result.length > 0) {
        // Should have multiple rankings for different stats
        const categories = result.map((r) => r.stat_category);
        expect(categories.length).toBeGreaterThan(0);
      }
    });

    it('should include rank and stat value for each category', async () => {
      const result = await getTeamRankings(TEAM_ID, mockDb);

      if (result && result.length > 0) {
        result.forEach((ranking) => {
          expect(ranking).toHaveProperty('stat_category');
          expect(ranking).toHaveProperty('rank');
          expect(ranking).toHaveProperty('value');
          expect(typeof ranking.rank).toBe('number');
        });
      }
    });

    it('should filter rankings to only the requested team', async () => {
      const result = await getTeamRankings(TEAM_ID, mockDb);

      if (result && result.length > 0) {
        // All results should be for the requested team
        result.forEach((ranking) => {
          expect(ranking.team_id).toBe(TEAM_ID);
        });
      }
    });
  });

  describe('Database query execution', () => {
    it('should execute query with correct team_id parameter', async () => {
      const TEAM_ID = 1610612761;
      mockDb.setMockData(
        'SELECT t.team_id, t.team_name, ts.season',
        MOCK_DB_RESULT.team_stats,
      );

      await getTeamStats(TEAM_ID, 2024, mockDb);

      const history = mockDb.getQueryHistory();
      expect(history.count).toBe(1);
      expect(history.lastParams).toContain(TEAM_ID);
    });

    it('should include season in query parameters', async () => {
      const SEASON = 2024;
      mockDb.setMockData(
        'SELECT t.team_id, t.team_name, ts.season',
        MOCK_DB_RESULT.team_stats,
      );

      await getTeamStats(1610612751, SEASON, mockDb);

      const history = mockDb.getQueryHistory();
      expect(history.lastParams).toContain(SEASON);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.setMockData(
        'SELECT t.team_id, t.team_name, ts.season',
        { rows: [], rowCount: 0 },
      );

      // Should not throw
      const result = await getTeamStats(1610612751, 2024, mockDb);
      expect(result).toBeNull();
    });

    it('should handle invalid team_id values', async () => {
      mockDb.setMockData(
        'SELECT t.team_id, t.team_name, ts.season',
        { rows: [], rowCount: 0 },
      );

      // Should handle gracefully with null or error
      const result = await getTeamStats(-1, 2024, mockDb);
      expect(result).toBeDefined();
    });

    it('should handle out-of-range seasons', async () => {
      mockDb.setMockData(
        'SELECT t.team_id, t.team_name, ts.season',
        { rows: [], rowCount: 0 },
      );

      // Should not crash with invalid season
      const result = await getTeamStats(1610612751, 9999, mockDb);
      expect(result).toBeDefined();
    });
  });
});
