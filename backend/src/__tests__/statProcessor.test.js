/**
 * Unit tests for statProcessor service
 * Tests data normalization, ranking calculation, and stat category processing
 */

const {
  normalizeTeamStats,
  calculateRankings,
  calculateAllRankings,
  processTeamStats,
  STAT_CATEGORIES,
} = require("../services/statProcessor");
const { MOCK_TEAM_STATS } = require("./mocks/testData");

describe("statProcessor", () => {
  describe("normalizeTeamStats", () => {
    it("should normalize array format team stats", () => {
      const input = {
        data: MOCK_TEAM_STATS,
        headers: ["TEAM_ID", "TEAM_NAME", "PTS", "REB", "AST", "FG_PCT"],
      };

      const result = normalizeTeamStats(input);

      expect(result).toHaveLength(MOCK_TEAM_STATS.length);
      expect(result[0]).toHaveProperty("team_id");
      expect(result[0]).toHaveProperty("team_name");
      expect(result[0]).toHaveProperty("stats");
    });

    it("should handle direct array input (mock data format)", () => {
      const result = normalizeTeamStats(MOCK_TEAM_STATS);

      expect(result).toHaveLength(MOCK_TEAM_STATS.length);
      expect(result[0].team_id).toBe(1610612751);
      expect(result[0].team_name).toBe("Brooklyn Nets");
      expect(result[0].stats).toHaveProperty("PPG", 115.4);
    });

    it("should parse stat values as numbers", () => {
      const result = normalizeTeamStats(MOCK_TEAM_STATS);

      expect(typeof result[0].stats.PPG).toBe("number");
      expect(typeof result[0].stats.RPG).toBe("number");
      expect(result[0].stats.PPG).toBe(115.4);
    });

    it("should handle missing fields gracefully", () => {
      const incomplete = [
        {
          id: 1,
          name: "Test Team",
          PPG: 100,
          // Missing other stats
        },
      ];

      const result = normalizeTeamStats(incomplete);

      expect(result[0].stats.PPG).toBe(100);
      expect(result[0].stats.RPG).toBe(0); // Defaults to 0
    });
  });

  describe("calculateRankings", () => {
    let normalizedStats;

    beforeEach(() => {
      normalizedStats = normalizeTeamStats(MOCK_TEAM_STATS);
    });

    it("should calculate rankings for a specific stat category", () => {
      const rankings = calculateRankings(normalizedStats, "PPG");

      expect(rankings).toHaveLength(MOCK_TEAM_STATS.length);
      expect(rankings[0].rank).toBe(1); // First place
      expect(rankings[0].stat_category).toBe("PPG");
    });

    it("should rank in descending order for higher-is-better stats", () => {
      const rankings = calculateRankings(normalizedStats, "PPG");

      // PPG: higher is better, so sort descending
      for (let i = 0; i < rankings.length - 1; i++) {
        expect(rankings[i].value).toBeGreaterThanOrEqual(rankings[i + 1].value);
      }
    });

    it("should include team info in rankings", () => {
      const rankings = calculateRankings(normalizedStats, "PPG");

      expect(rankings[0]).toHaveProperty("team_id");
      expect(rankings[0]).toHaveProperty("team_name");
      expect(rankings[0]).toHaveProperty("value");
      expect(rankings[0]).toHaveProperty("stat_label");
    });

    it("should throw error for unknown stat category", () => {
      expect(() => {
        calculateRankings(normalizedStats, "INVALID_STAT");
      }).toThrow("Unknown stat category: INVALID_STAT");
    });

    it("should handle stats where lower is better (TOV%)", () => {
      const statsWithTurnovers = normalizedStats.map((team) => ({
        ...team,
        stats: {
          ...team.stats,
          "TOV%": 15 - Math.random() * 5, // Lower is better
        },
      }));

      const rankings = calculateRankings(statsWithTurnovers, "TOV%");

      // For TOV%, lower is better, so sort ascending
      for (let i = 0; i < rankings.length - 1; i++) {
        expect(rankings[i].value).toBeLessThanOrEqual(rankings[i + 1].value);
      }
    });

    it("should apply competition ranking for ties (same rank, skip next)", () => {
      // Create mock data with ties
      const teamsWithTies = [
        { team_id: 1, team_name: "Team A", stats: { PPG: 120 } },
        { team_id: 2, team_name: "Team B", stats: { PPG: 120 } }, // Tied with A
        { team_id: 3, team_name: "Team C", stats: { PPG: 120 } }, // Tied with A and B
        { team_id: 4, team_name: "Team D", stats: { PPG: 115 } }, // Next highest
        { team_id: 5, team_name: "Team E", stats: { PPG: 110 } },
      ];

      const rankings = calculateRankings(teamsWithTies, "PPG");

      // All three teams with 120 should have rank 1
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].value).toBe(120);
      expect(rankings[1].rank).toBe(1);
      expect(rankings[1].value).toBe(120);
      expect(rankings[2].rank).toBe(1);
      expect(rankings[2].value).toBe(120);

      // Team D with 115 should have rank 4 (not 2), skipping ranks 2 and 3
      expect(rankings[3].rank).toBe(4);
      expect(rankings[3].value).toBe(115);

      // Team E with 110 should have rank 5
      expect(rankings[4].rank).toBe(5);
      expect(rankings[4].value).toBe(110);
    });

    it("should correctly skip ranks after multiple ties", () => {
      // Test scenario: 2 teams tied for 2nd, should skip to 4th
      const teamsWithPairTie = [
        { team_id: 1, team_name: "Team 1", stats: { PPG: 120 } },
        { team_id: 2, team_name: "Team 2", stats: { PPG: 115 } },
        { team_id: 3, team_name: "Team 3", stats: { PPG: 115 } }, // Tied with Team 2
        { team_id: 4, team_name: "Team 4", stats: { PPG: 110 } },
      ];

      const rankings = calculateRankings(teamsWithPairTie, "PPG");

      expect(rankings[0].rank).toBe(1); // Team 1: 120
      expect(rankings[1].rank).toBe(2); // Team 2: 115
      expect(rankings[2].rank).toBe(2); // Team 3: 115 (tied with Team 2)
      expect(rankings[3].rank).toBe(4); // Team 4: 110 (skip rank 3)
    });

    it("should handle competition ranking for lower-is-better stats", () => {
      // Test with a lower-is-better stat (e.g., DRTG - defensive rating)
      const statsWithDRTG = [
        { team_id: 1, team_name: "Team A", stats: { DRTG: 105 } },
        { team_id: 2, team_name: "Team B", stats: { DRTG: 108 } },
        { team_id: 3, team_name: "Team C", stats: { DRTG: 108 } }, // Tied with B
        { team_id: 4, team_name: "Team D", stats: { DRTG: 110 } },
      ];

      const rankings = calculateRankings(statsWithDRTG, "DRTG");

      // Lower is better, so Team A (105) should be rank 1
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].value).toBe(105);

      // Teams B and C (108) should both be rank 2
      expect(rankings[1].rank).toBe(2);
      expect(rankings[1].value).toBe(108);
      expect(rankings[2].rank).toBe(2);
      expect(rankings[2].value).toBe(108);

      // Team D (110) should be rank 4 (skip rank 3)
      expect(rankings[3].rank).toBe(4);
      expect(rankings[3].value).toBe(110);
    });

    it("should handle all teams with same value (all tied for rank 1)", () => {
      const allTiedTeams = [
        { team_id: 1, team_name: "Team A", stats: { PPG: 100 } },
        { team_id: 2, team_name: "Team B", stats: { PPG: 100 } },
        { team_id: 3, team_name: "Team C", stats: { PPG: 100 } },
      ];

      const rankings = calculateRankings(allTiedTeams, "PPG");

      // All should be rank 1
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].rank).toBe(1);
      expect(rankings[2].rank).toBe(1);
    });
  });

  describe("calculateAllRankings", () => {
    it("should calculate rankings for all stat categories", () => {
      const normalizedStats = normalizeTeamStats(MOCK_TEAM_STATS);
      const allRankings = calculateAllRankings(normalizedStats);

      // Should have entries for all categories
      expect(Object.keys(allRankings).length).toBeGreaterThan(0);
    });

    it("should include common categories like PPG and RPG", () => {
      const normalizedStats = normalizeTeamStats(MOCK_TEAM_STATS);
      const allRankings = calculateAllRankings(normalizedStats);

      expect(allRankings).toHaveProperty("PPG");
      expect(allRankings).toHaveProperty("RPG");
      expect(allRankings).toHaveProperty("APG");
    });

    it("should handle calculation failures gracefully", () => {
      const normalizedStats = normalizeTeamStats(MOCK_TEAM_STATS);

      // This should not throw even if some categories fail
      expect(() => {
        calculateAllRankings(normalizedStats);
      }).not.toThrow();
    });
  });

  describe("processTeamStats", () => {
    it("should process raw team stats data", () => {
      const result = processTeamStats(MOCK_TEAM_STATS);

      expect(result).toHaveProperty("normalized_stats");
      expect(result).toHaveProperty("rankings");
      expect(Array.isArray(result.normalized_stats)).toBe(true);
      expect(typeof result.rankings).toBe("object");
    });

    it("should return normalized stats in correct format", () => {
      const result = processTeamStats(MOCK_TEAM_STATS);

      expect(result.normalized_stats[0]).toHaveProperty("team_id");
      expect(result.normalized_stats[0]).toHaveProperty("team_name");
      expect(result.normalized_stats[0]).toHaveProperty("stats");
    });

    it("should generate rankings for multiple categories", () => {
      const result = processTeamStats(MOCK_TEAM_STATS);

      expect(Object.keys(result.rankings).length).toBeGreaterThan(5);
    });
  });

  describe("STAT_CATEGORIES", () => {
    it("should define standard NBA stat categories", () => {
      expect(STAT_CATEGORIES).toHaveProperty("PPG");
      expect(STAT_CATEGORIES).toHaveProperty("RPG");
      expect(STAT_CATEGORIES).toHaveProperty("APG");
      expect(STAT_CATEGORIES).toHaveProperty("FG%");
    });

    it("should mark lower-is-better stats correctly", () => {
      expect(STAT_CATEGORIES["TOV%"].lower).toBe(true);
      expect(STAT_CATEGORIES.PPG.lower).toBe(false);
    });

    it("should include label and index for each category", () => {
      Object.values(STAT_CATEGORIES).forEach((category) => {
        expect(category).toHaveProperty("label");
        expect(category).toHaveProperty("index");
      });
    });
  });
});
