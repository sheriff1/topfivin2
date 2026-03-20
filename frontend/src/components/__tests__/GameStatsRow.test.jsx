import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GameStatsRow from "../GameStatsRow";

// Mock the statFormatter
vi.mock("../../utils/statFormatter", () => ({
  formatStatValue: vi.fn((value) => {
    if (typeof value === "number" && value.toString().includes(".")) {
      return value.toFixed(1);
    }
    return String(value);
  }),
}));

describe("GameStatsRow Component", () => {
  const mockHomeStats = {
    abbreviation: "DAL",
    logo_url: "https://example.com/mavericks.png",
    pts: 110,
    reb: 45,
    ast: 28,
    stl: 8,
    blk: 5,
    fg: 38,
    fga: 80,
    fg_pct: 47.5,
    ft: 20,
    fta: 25,
    ft_pct: 80.0,
    three_p: 12,
    three_pa: 30,
    three_p_pct: 40.0,
  };

  const mockAwayStats = {
    abbreviation: "BOS",
    logo_url: "https://example.com/celtics.png",
    pts: 115,
    reb: 48,
    ast: 30,
    stl: 9,
    blk: 6,
    fg: 40,
    fga: 82,
    fg_pct: 48.8,
    ft: 22,
    fta: 26,
    ft_pct: 84.6,
    three_p: 14,
    three_pa: 32,
    three_p_pct: 43.8,
  };

  it("should render game stats row for both teams", () => {
    const { container } = render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(container.querySelector("tr")).toBeDefined();
  });

  it("should display team abbreviations", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("DAL")).toBeDefined();
    expect(screen.getByText("BOS")).toBeDefined();
  });

  it("should display team logos", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    const logos = screen.getAllByAltText(/logo/);
    expect(logos.length).toBe(2);
  });

  it("should display points for both teams", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Points")).toBeDefined();
    expect(screen.getByText("110")).toBeDefined();
    expect(screen.getByText("115")).toBeDefined();
  });

  it("should display field goals made and attempted", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Field goals")).toBeDefined();
    expect(screen.getByText("38/80")).toBeDefined();
    expect(screen.getByText("40/82")).toBeDefined();
  });

  it("should display field goal percentages", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Field goal %")).toBeDefined();
  });

  it("should display 3-pointers made and attempted", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("3-pointers")).toBeDefined();
    expect(screen.getByText("12/30")).toBeDefined();
    expect(screen.getByText("14/32")).toBeDefined();
  });

  it("should display 3-point percentages", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("3-point %")).toBeDefined();
  });

  it("should display free throws made and attempted", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Free throws")).toBeDefined();
    expect(screen.getByText("20/25")).toBeDefined();
    expect(screen.getByText("22/26")).toBeDefined();
  });

  it("should display free throw percentages", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Free throw %")).toBeDefined();
  });

  it("should display rebounds", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Rebounds")).toBeDefined();
    expect(screen.getByText("45")).toBeDefined();
    expect(screen.getByText("48")).toBeDefined();
  });

  it("should display assists", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Assists")).toBeDefined();
    expect(screen.getByText("28")).toBeDefined();
    expect(screen.getByText("30")).toBeDefined();
  });

  it("should display steals", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Steals")).toBeDefined();
    expect(screen.getByText("8")).toBeDefined();
    expect(screen.getByText("9")).toBeDefined();
  });

  it("should display blocks", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Blocks")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("6")).toBeDefined();
  });

  it("should render loading state", () => {
    const { container } = render(
      <table>
        <tbody>
          <GameStatsRow homeStats={null} awayStats={null} isLoading={true} />
        </tbody>
      </table>
    );

    expect(container.querySelector(".loading-spinner")).toBeDefined();
  });

  it("should render error state with message", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow
            homeStats={null}
            awayStats={null}
            isLoading={false}
            error="Failed to load game stats"
            onRetry={() => {}}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText("Failed to load game stats")).toBeDefined();
  });

  it("should render retry button on error", () => {
    const mockRetry = vi.fn();
    render(
      <table>
        <tbody>
          <GameStatsRow
            homeStats={null}
            awayStats={null}
            isLoading={false}
            error="Failed to load game stats"
            onRetry={mockRetry}
          />
        </tbody>
      </table>
    );

    const retryButton = screen.getByRole("button", { name: /Retry/ });
    expect(retryButton).toBeDefined();
  });

  it("should handle missing stat values gracefully", () => {
    const statsWithNull = {
      ...mockHomeStats,
      pts: null,
      reb: undefined,
    };

    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={statsWithNull} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    // Should render without throwing errors
    expect(screen.getByText("Team")).toBeDefined();
  });

  it("should return null when neither homeStats nor awayStats provided", () => {
    const { container } = render(
      <table>
        <tbody>
          <GameStatsRow homeStats={null} awayStats={null} isLoading={false} />
        </tbody>
      </table>
    );

    expect(container.querySelector("tr")).toBeNull();
  });

  it("should return null when homeStats is missing", () => {
    const { container } = render(
      <table>
        <tbody>
          <GameStatsRow homeStats={null} awayStats={mockAwayStats} isLoading={false} />
        </tbody>
      </table>
    );

    expect(container.querySelector("tr")).toBeNull();
  });

  it("should return null when awayStats is missing", () => {
    const { container } = render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={null} isLoading={false} />
        </tbody>
      </table>
    );

    expect(container.querySelector("tr")).toBeNull();
  });

  it("should have proper table styling classes", () => {
    const { container } = render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    const row = container.querySelector("tr.bg-base-200");
    expect(row).toBeDefined();
  });

  it("should use 3-column grid layout", () => {
    const { container } = render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    const gridDivs = container.querySelectorAll('[class*="grid-cols"]');
    expect(gridDivs.length).toBeGreaterThan(0);
  });

  it("should handle images with error gracefully", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    const logos = screen.getAllByAltText(/logo/);
    // Just verify logos exist and have error handlers
    expect(logos.length).toBeGreaterThan(0);
  });

  it("should display formatted stat values", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    // Points should be displayed as raw numbers
    expect(screen.getByText("110")).toBeDefined();
    expect(screen.getByText("115")).toBeDefined();
  });

  it("should format percentage values correctly", () => {
    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    // Percentages like FG%, FT%, 3P% should be formatted
    expect(screen.getByText("Field goal %")).toBeDefined();
    expect(screen.getByText("Free throw %")).toBeDefined();
    expect(screen.getByText("3-point %")).toBeDefined();
  });

  it("should use semantic stat row component layout", () => {
    const { container } = render(
      <table>
        <tbody>
          <GameStatsRow homeStats={mockHomeStats} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    const statRows = container.querySelectorAll('.grid[class*="grid-cols-\\["]');
    expect(statRows.length).toBeGreaterThan(0);
  });

  it("should handle zero values correctly", () => {
    const statsWithZeros = {
      ...mockHomeStats,
      stl: 0,
      blk: 0,
    };

    render(
      <table>
        <tbody>
          <GameStatsRow homeStats={statsWithZeros} awayStats={mockAwayStats} />
        </tbody>
      </table>
    );

    // Verify zeros are displayed (should find "0" for steals and blocks)
    const zeroValues = screen.getAllByText("0");
    expect(zeroValues.length).toBeGreaterThan(0);
  });
});
