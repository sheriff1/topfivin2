import { describe, it, expect } from "vitest";
import { formatSeasonLabel } from "../season";

describe("formatSeasonLabel", () => {
  it("formats a season year", () => {
    expect(formatSeasonLabel("2025")).toBe("2025-26");
    expect(formatSeasonLabel(2026)).toBe("2026-27");
  });
  it("handles century rollover", () => {
    expect(formatSeasonLabel("1999")).toBe("1999-00");
  });
  it("returns empty string for invalid input", () => {
    expect(formatSeasonLabel(null)).toBe("");
    expect(formatSeasonLabel("abc")).toBe("");
  });
});
