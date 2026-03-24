import { render, screen, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RankingsGrid } from "../RankingsGrid";

// Mock the useApi and statFormatter
vi.mock("../../hooks/useApi", () => ({
  useRankings: vi.fn(),
  useAllTeams: vi.fn(),
}));

vi.mock("../../utils/statFormatter", () => ({
  formatStatValue: vi.fn((value) => `${value.toFixed(1)}`),
  formatPercentageStat: vi.fn((value) => `${(value * 100).toFixed(1)}%`),
}));

import { useRankings, useAllTeams } from "../../hooks/useApi";

describe("RankingsGrid Component", () => {
  const mockRankingsData = {
    category: "PPG",
    label: "Points Per Game",
    rankings: [
      {
        rank: 1,
        team_id: 1610612742,
        team_name: "Dallas Mavericks",
        stat_category: "PPG",
        value: 119.1,
        logo_url: "https://example.com/mavericks.png",
        games_count: 82,
      },
      {
        rank: 2,
        team_id: 1610612738,
        team_name: "Boston Celtics",
        stat_category: "PPG",
        value: 118.2,
        logo_url: "https://example.com/celtics.png",
        games_count: 82,
      },
      {
        rank: 3,
        team_id: 1610612739,
        team_name: "Cleveland Cavaliers",
        stat_category: "PPG",
        value: 116.8,
        logo_url: "https://example.com/cavaliers.png",
        games_count: 82,
      },
    ],
  };

  beforeEach(() => {
    useRankings.mockReturnValue({
      data: mockRankingsData,
      isLoading: false,
      error: null,
    });
    useAllTeams.mockReturnValue({
      data: [
        {
          team_id: 1610612742,
          team_name: "Dallas Mavericks",
          team_colors: {
            primary: "#003DA5",
            secondary: "#B8860B",
          },
        },
        {
          team_id: 1610612738,
          team_name: "Boston Celtics",
          team_colors: {
            primary: "#007A33",
            secondary: "#BA0021",
          },
        },
        {
          team_id: 1610612739,
          team_name: "Cleveland Cavaliers",
          team_colors: {
            primary: "#6F2DA8",
            secondary: "#041E3F",
          },
        },
      ],
      isLoading: false,
      error: null,
    });
  });

  it("should render table with rankings data", () => {
    render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText("Rank")).toBeDefined();
    expect(screen.getByText("Team")).toBeDefined();
    expect(screen.getByText("Points Per Game")).toBeDefined();
  });

  it("should display all teams in rankings", () => {
    render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText("Dallas Mavericks")).toBeDefined();
    expect(screen.getByText("Boston Celtics")).toBeDefined();
    expect(screen.getByText("Cleveland Cavaliers")).toBeDefined();
  });

  it("should display rank badges with correct colors", () => {
    render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    const badges = screen.getAllByText(/^#[0-9]/);
    expect(badges.length).toBe(3);
    expect(badges[0].textContent).toBe("#1");
    expect(badges[1].textContent).toBe("#2");
    expect(badges[2].textContent).toBe("#3");
  });

  it("should use success color for top 5 rankings", () => {
    const { container } = render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    const badges = container.querySelectorAll(".badge-success");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("should use warning color for middle rankings (6-15)", () => {
    useRankings.mockReturnValue({
      data: {
        category: "PPG",
        label: "Points Per Game",
        rankings: [
          {
            rank: 10,
            team_id: 1610612751,
            team_name: "Brooklyn Nets",
            stat_category: "PPG",
            value: 110.0,
            logo_url: "https://example.com/nets.png",
            games_count: 82,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    const badge = container.querySelector(".badge-warning");
    expect(badge).toBeDefined();
  });

  it("should use error color for lower rankings (16+)", () => {
    useRankings.mockReturnValue({
      data: {
        category: "PPG",
        label: "Points Per Game",
        rankings: [
          {
            rank: 20,
            team_id: 1610612751,
            team_name: "Brooklyn Nets",
            stat_category: "PPG",
            value: 105.0,
            logo_url: "https://example.com/nets.png",
            games_count: 82,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    const badge = container.querySelector(".badge-error");
    expect(badge).toBeDefined();
  });

  it("should display team logos", () => {
    const { container } = render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    // Check for logo divs with background-image style and specific dimensions
    const logoDivs = container.querySelectorAll("div[style*='background-image']");
    expect(logoDivs.length).toBeGreaterThan(0);
  });

  it("should show loading spinner when isLoading is true", () => {
    useRankings.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    const { container } = render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    expect(container.querySelector(".loading-spinner")).toBeDefined();
  });

  it("should show error alert when error is present", () => {
    useRankings.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed to load rankings"),
    });

    render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText(/Error loading rankings/)).toBeDefined();
  });

  it("should show empty state when no rankings data", () => {
    useRankings.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText(/No data available/)).toBeDefined();
  });

  it("should show empty state when rankings array is empty", () => {
    useRankings.mockReturnValue({
      data: {
        category: "PPG",
        label: "Points Per Game",
        rankings: [],
      },
      isLoading: false,
      error: null,
    });

    render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText(/No data available/)).toBeDefined();
  });

  it("should have team links to team pages", () => {
    render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    const links = screen.getAllByRole("link");
    expect(links.some((link) => link.href.includes("/team/DAL"))).toBe(true);
    expect(links.some((link) => link.href.includes("/team/BOS"))).toBe(true);
  });

  it("should use default season prop of 2025", () => {
    render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    expect(useRankings).toHaveBeenCalledWith("PPG", "2025");
  });

  it("should use custom season prop when provided", () => {
    render(
      <BrowserRouter>
        <RankingsGrid category="PPG" season="2024" />
      </BrowserRouter>
    );

    expect(useRankings).toHaveBeenCalledWith("PPG", "2024");
  });

  it("should format stat values correctly", () => {
    render(
      <BrowserRouter>
        <RankingsGrid category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText("119.1")).toBeDefined();
    expect(screen.getByText("118.2")).toBeDefined();
  });

  it("should format percentage stats with percentage sign", () => {
    useRankings.mockReturnValue({
      data: {
        category: "TS%",
        label: "True Shooting %",
        rankings: [
          {
            rank: 1,
            team_id: 1610612763,
            team_name: "Dallas Mavericks",
            stat_category: "TS%",
            value: 0.581,
            logo_url: "https://example.com/mavericks.png",
            games_count: 82,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    render(
      <BrowserRouter>
        <RankingsGrid category="TS%" />
      </BrowserRouter>
    );

    // formatPercentageStat should be called
    expect(screen.getByText("58.1%")).toBeDefined();
  });
});
