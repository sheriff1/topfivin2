import { describe, it, expect } from "vitest";
import { formatStatValue, formatPercentageStat } from "../statFormatter";

describe("statFormatter Utility", () => {
  describe("formatStatValue", () => {
    it("should format regular stat values with 2 decimal places", () => {
      expect(formatStatValue(23.456, "Points Per Game")).toBe("23.46");
      expect(formatStatValue(115.4, "PPG")).toBe("115.40");
      expect(formatStatValue(44.999, "RPG")).toBe("45.00");
    });

    it("should format percentage stats with % symbol", () => {
      expect(formatStatValue(45.67, "Field Goal %")).toBe("45.67%");
      expect(formatStatValue(89.123, "True Shooting %")).toBe("89.12%");
      expect(formatStatValue(50, "TS%")).toBe("50.00%");
    });

    it("should detect percentage category by label containing %", () => {
      // Categories with % should be formatted as percentages
      expect(formatStatValue(45.5, "Field Goal %")).toBe("45.50%");
      expect(formatStatValue(45.5, "Free Throw %")).toBe("45.50%");
      expect(formatStatValue(45.5, "3-Point %")).toBe("45.50%");
    });

    it("should not format as percentage when label doesn't contain %", () => {
      expect(formatStatValue(45.5, "Points Per Game")).toBe("45.50");
      expect(formatStatValue(45.5, "Rebounds Per Game")).toBe("45.50");
      expect(formatStatValue(45.5, "Assists")).toBe("45.50");
    });

    it("should handle null values", () => {
      expect(formatStatValue(null, "PPG")).toBe("—");
    });

    it("should handle undefined values", () => {
      expect(formatStatValue(undefined, "RPG")).toBe("—");
    });

    it("should handle NaN values", () => {
      expect(formatStatValue(NaN, "APG")).toBe("—");
    });

    it("should handle empty label", () => {
      expect(formatStatValue(45.5, "")).toBe("45.50");
    });

    it("should handle null label", () => {
      expect(formatStatValue(45.5, null)).toBe("45.50");
    });

    it("should handle undefined label", () => {
      expect(formatStatValue(45.5, undefined)).toBe("45.50");
    });

    it("should format zero values correctly", () => {
      expect(formatStatValue(0, "PPG")).toBe("0.00");
      expect(formatStatValue(0, "Field Goal %")).toBe("0.00%");
    });

    it("should format negative values (edge case)", () => {
      expect(formatStatValue(-5.5, "PPG")).toBe("-5.50");
      expect(formatStatValue(-5.5, "Field Goal %")).toBe("-5.50%");
    });

    it("should handle very large numbers", () => {
      expect(formatStatValue(9999.999, "PPG")).toBe("10000.00");
      expect(formatStatValue(99999.999, "Rebounds")).toBe("100000.00");
    });

    it("should handle very small numbers", () => {
      expect(formatStatValue(0.001, "PPG")).toBe("0.00");
      expect(formatStatValue(0.005, "RPG")).toBe("0.01");
    });

    it("should handle string numbers (coercion)", () => {
      // parseFloat should handle string conversion
      expect(formatStatValue("45.67", "PPG")).toBe("45.67");
      expect(formatStatValue("89.123", "Field Goal %")).toBe("89.12%");
    });

    it("should handle case-insensitive % detection", () => {
      // The implementation checks for % symbol presence
      expect(formatStatValue(45, "Field Goal %")).toBe("45.00%");
      expect(formatStatValue(45, "field goal %")).toBe("45.00%");
      expect(formatStatValue(45, "FIELD GOAL %")).toBe("45.00%");
    });

    it("should maintain precision before formatting", () => {
      // Test rounding behavior
      expect(formatStatValue(1.234, "PPG")).toBe("1.23");
      expect(formatStatValue(1.235, "PPG")).toBe("1.24");
      expect(formatStatValue(1.245, "PPG")).toBe("1.25");
    });

    it("should handle various NBA stat categories", () => {
      const categories = [
        { value: 115.4, label: "Points Per Game", expected: "115.40" },
        { value: 44.2, label: "Rebounds Per Game", expected: "44.20" },
        { value: 28.5, label: "Assists Per Game", expected: "28.50" },
        { value: 7.1, label: "Steals Per Game", expected: "7.10" },
        { value: 5.2, label: "Blocks Per Game", expected: "5.20" },
        { value: 45.5, label: "Field Goal %", expected: "45.50%" },
        { value: 89.01, label: "Free Throw %", expected: "89.01%" },
      ];

      categories.forEach(({ value, label, expected }) => {
        expect(formatStatValue(value, label)).toBe(expected);
      });
    });
  });

  describe("formatPercentageStat", () => {
    it("should convert 0-1 range to percentage", () => {
      expect(formatPercentageStat(0.5, "Field Goal %")).toBe("50.00%");
      expect(formatPercentageStat(0.45, "True Shooting %")).toBe("45.00%");
      expect(formatPercentageStat(0.89, "Free Throw %")).toBe("89.00%");
    });

    it("should format with 2 decimal places", () => {
      expect(formatPercentageStat(0.456, "Field Goal %")).toBe("45.60%");
      expect(formatPercentageStat(0.4567, "FG%")).toBe("45.67%");
      expect(formatPercentageStat(0.45678, "TS%")).toBe("45.68%");
    });

    it("should handle complete ranges (0 to 1)", () => {
      expect(formatPercentageStat(0, "PPG")).toBe("0.00%");
      expect(formatPercentageStat(1, "PPG")).toBe("100.00%");
      expect(formatPercentageStat(0.25, "PPG")).toBe("25.00%");
      expect(formatPercentageStat(0.75, "PPG")).toBe("75.00%");
    });

    it("should handle null values", () => {
      expect(formatPercentageStat(null, "Field Goal %")).toBe("—");
    });

    it("should handle undefined values", () => {
      expect(formatPercentageStat(undefined, "True Shooting %")).toBe("—");
    });

    it("should handle NaN values", () => {
      expect(formatPercentageStat(NaN, "FG%")).toBe("—");
    });

    it("should handle empty label", () => {
      expect(formatPercentageStat(0.5, "")).toBe("50.00%");
    });

    it("should handle null label", () => {
      expect(formatPercentageStat(0.5, null)).toBe("50.00%");
    });

    it("should handle undefined label", () => {
      expect(formatPercentageStat(0.5, undefined)).toBe("50.00%");
    });

    it("should handle string numbers (coercion)", () => {
      expect(formatPercentageStat("0.5", "Field Goal %")).toBe("50.00%");
      expect(formatPercentageStat("0.456", "FG%")).toBe("45.60%");
    });

    it("should handle edge case of very small values", () => {
      expect(formatPercentageStat(0.001, "PPG")).toBe("0.10%");
      expect(formatPercentageStat(0.0001, "PPG")).toBe("0.01%");
      expect(formatPercentageStat(0.00001, "PPG")).toBe("0.00%");
    });

    it("should handle values slightly over 1 (error cases)", () => {
      // In real scenarios, this shouldn't happen, but test for robustness
      expect(formatPercentageStat(1.05, "Field Goal %")).toBe("105.00%");
      expect(formatPercentageStat(1.5, "FG%")).toBe("150.00%");
    });

    it("should handle negative values (error cases)", () => {
      // In real scenarios, this shouldn't happen, but test for robustness
      expect(formatPercentageStat(-0.5, "Field Goal %")).toBe("-50.00%");
      expect(formatPercentageStat(-0.1, "FG%")).toBe("-10.00%");
    });

    it("should maintain API response format correctly", () => {
      // Typical API responses come as 0-1 range
      const apiResponses = [
        { value: 0.4567, label: "TS%", expected: "45.67%" },
        { value: 0.3789, label: "FG%", expected: "37.89%" },
        { value: 0.789, label: "FT%", expected: "78.90%" },
      ];

      apiResponses.forEach(({ value, label, expected }) => {
        expect(formatPercentageStat(value, label)).toBe(expected);
      });
    });

    it("should handle rounding correctly", () => {
      expect(formatPercentageStat(0.454, "PPG")).toBe("45.40%");
      expect(formatPercentageStat(0.455, "PPG")).toBe("45.50%");
      expect(formatPercentageStat(0.456, "PPG")).toBe("45.60%");
    });

    it("should work with actual NBA stat percentages", () => {
      // Common NBA stat percentages in 0-1 range
      const stats = [
        { name: "FG% (league avg)", value: 0.4640, expected: "46.40%" },
        { name: "3P% (league avg)", value: 0.3650, expected: "36.50%" },
        { name: "FT% (league avg)", value: 0.7790, expected: "77.90%" },
      ];

      stats.forEach(({ value, expected }) => {
        expect(formatPercentageStat(value, "Percentage")).toBe(expected);
      });
    });
  });

  describe("Cross-function edge cases", () => {
    it("should handle the same value differently based on function used", () => {
      // formatStatValue for 0.5 as percentage: "0.50%"
      // formatPercentageStat for 0.5: "50.00%"
      expect(formatStatValue(0.5, "Field Goal %")).toBe("0.50%");
      expect(formatPercentageStat(0.5, "Field Goal %")).toBe("50.00%");
    });

    it("should use dash character for invalid inputs consistently", () => {
      // Test invalid inputs that are properly handled
      expect(formatStatValue(null, "PPG")).toBe("—");
      expect(formatPercentageStat(null, "FG%")).toBe("—");
      expect(formatStatValue(undefined, "PPG")).toBe("—");
      expect(formatPercentageStat(undefined, "FG%")).toBe("—");
      expect(formatStatValue(NaN, "PPG")).toBe("—");
      expect(formatPercentageStat(NaN, "FG%")).toBe("—");
    });
  });

  describe("Performance and consistency", () => {
    it("should handle repeated calls consistently", () => {
      const value = 45.6789;
      const result1 = formatStatValue(value, "Field Goal %");
      const result2 = formatStatValue(value, "Field Goal %");

      expect(result1).toBe(result2);
    });

    it("should handle multiple different values in sequence", () => {
      const values = [10, 20.5, 45.67, 99.999, 0.001];

      values.forEach((value) => {
        const result = formatStatValue(value, "PPG");
        expect(result).toMatch(/^\d+\.\d{2}$/);
      });
    });

    it("should handle rapid consecutive calls", () => {
      for (let i = 0; i < 100; i++) {
        expect(formatStatValue(45.67, "PPG")).toBe("45.67");
      }
    });
  });

  describe("Integration scenarios", () => {
    it("should work for rendering stat tables", () => {
      const statsData = [
        { category: "PPG", value: 115.4 },
        { category: "RPG", value: 44.2 },
        { category: "APG", value: 28.5 },
      ];

      const formatted = statsData.map((stat) =>
        formatStatValue(stat.value, stat.category)
      );

      expect(formatted).toEqual(["115.40", "44.20", "28.50"]);
    });

    it("should work for rendering percentage stats in tables", () => {
      const statsData = [
        { category: "FG%", value: 0.4640 },
        { category: "3P%", value: 0.3650 },
        { category: "FT%", value: 0.7790 },
      ];

      const formatted = statsData.map((stat) =>
        formatPercentageStat(stat.value, stat.category)
      );

      expect(formatted).toEqual(["46.40%", "36.50%", "77.90%"]);
    });

    it("should handle mixed stat types in a single view", () => {
      const mixedStats = [
        { label: "Points Per Game", value: 115.4, type: "regular" },
        { label: "Field Goal %", value: 0.456, type: "percentage" },
        { label: "Rebounds", value: 44.2, type: "regular" },
      ];

      const formatted = mixedStats.map((stat) => {
        if (stat.type === "percentage") {
          return formatPercentageStat(stat.value, stat.label);
        }
        return formatStatValue(stat.value, stat.label);
      });

      expect(formatted).toEqual(["115.40", "45.60%", "44.20"]);
    });
  });
});
