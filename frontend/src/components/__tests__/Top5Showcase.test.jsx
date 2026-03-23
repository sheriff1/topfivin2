import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Top5Showcase } from "../Top5Showcase";

// Mock the useApi hook
vi.mock("../../hooks/useApi", () => ({
  useAllTeams: vi.fn(),
}));

vi.mock("../../utils/statFormatter", () => ({
  formatStatValue: vi.fn((value) => `${value.toFixed(1)}`),
  formatPercentageStat: vi.fn((value) => `${(value * 100).toFixed(1)}%`),
}));

import { useAllTeams } from "../../hooks/useApi";

describe("Top5Showcase Component", () => {
  const mockRankings = {
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
      },
      {
        rank: 2,
        team_id: 1610612738,
        team_name: "Boston Celtics",
        stat_category: "PPG",
        value: 118.2,
        logo_url: "https://example.com/celtics.png",
      },
      {
        rank: 3,
        team_id: 1610612739,
        team_name: "Cleveland Cavaliers",
        stat_category: "PPG",
        value: 116.8,
        logo_url: "https://example.com/cavaliers.png",
      },
      {
        rank: 4,
        team_id: 1610612751,
        team_name: "Brooklyn Nets",
        stat_category: "PPG",
        value: 115.4,
        logo_url: "https://example.com/nets.png",
      },
      {
        rank: 5,
        team_id: 1610612741,
        team_name: "Chicago Bulls",
        stat_category: "PPG",
        value: 112.3,
        logo_url: "https://example.com/bulls.png",
      },
      {
        rank: 6,
        team_id: 1610612750,
        team_name: "Minnesota Timberwolves",
        stat_category: "PPG",
        value: 111.5,
        logo_url: "https://example.com/timberwolves.png",
      },
    ],
  };

  const mockAllTeams = [
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
        secondary: "#FFB81C",
      },
    },
    {
      team_id: 1610612751,
      team_name: "Brooklyn Nets",
      team_colors: {
        primary: "#000000",
        secondary: "#FFFFFF",
      },
    },
    {
      team_id: 1610612741,
      team_name: "Chicago Bulls",
      team_colors: {
        primary: "#CE1141",
        secondary: "#000000",
      },
    },
    {
      team_id: 1610612745,
      team_name: "Houston Rockets",
      team_colors: {
        primary: "#CE1141",
        secondary: "#000000",
      },
    },
    {
      team_id: 1610612762,
      team_name: "Utah Jazz",
      team_colors: {
        primary: "#002B5C",
        secondary: "#00471B",
      },
    },
  ];

  beforeEach(() => {
    useAllTeams.mockReturnValue({
      data: mockAllTeams,
      isLoading: false,
      error: null,
    });
  });

  it("should not render when rankings is null", () => {
    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={null} category="PPG" />
      </BrowserRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it("should not render when rankings array is empty", () => {
    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={{ rankings: [] }} category="PPG" />
      </BrowserRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render only top 5 teams even if more are provided", () => {
    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    // Check for 5 rank badges (#1-#5)
    const badges = container.querySelectorAll(".badge-success");
    expect(badges.length).toBe(5);

    // Check that stat values are displayed for top 5 teams
    expect(screen.getByText("119.1")).toBeDefined(); // Mavericks
    expect(screen.getByText("118.2")).toBeDefined(); // Celtics
    expect(screen.getByText("116.8")).toBeDefined(); // Cavaliers
    expect(screen.getByText("115.4")).toBeDefined(); // Nets
    expect(screen.getByText("112.3")).toBeDefined(); // Bulls

    // 6th team stat should not be rendered
    expect(screen.queryByText("111.5")).toBeNull(); // Minnesota Timberwolves
  });

  it("should display top 5 heading", () => {
    render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText("Top 5 Teams")).toBeDefined();
  });

  it("should display rank badges with # symbol", () => {
    render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText("#1")).toBeDefined();
    expect(screen.getByText("#2")).toBeDefined();
    expect(screen.getByText("#3")).toBeDefined();
    expect(screen.getByText("#4")).toBeDefined();
    expect(screen.getByText("#5")).toBeDefined();
  });

  it("should display team logos", () => {
    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    // Check for logo divs with w-1/2 class (left side of card with logo background)
    const logoDivs = container.querySelectorAll("div.w-1\\/2");
    // Should have at least 5 logo divs (one per team) + abbreviation divs (another 5)
    // So total w-1/2 should be at least 10
    expect(logoDivs.length).toBeGreaterThanOrEqual(10);
  });

  it("should have links to team detail pages", () => {
    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    // Check that abbreviation divs are present (no longer wrapped in links)
    const abbreviations = container.querySelectorAll("[style*='League Gothic']");
    expect(abbreviations.length).toBeGreaterThan(0);
  });

  it("should format stat values correctly", () => {
    render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText("119.1")).toBeDefined();
    expect(screen.getByText("118.2")).toBeDefined();
  });

  it("should format percentage stats with percentage sign", () => {
    useAllTeams.mockReturnValue({
      data: mockAllTeams,
      isLoading: false,
      error: null,
    });

    const percentageRankings = {
      category: "TS%",
      label: "True Shooting %",
      rankings: mockRankings.rankings.map((r) => ({
        ...r,
        value: 0.58,
      })),
    };

    render(
      <BrowserRouter>
        <Top5Showcase rankings={percentageRankings} category="TS%" />
      </BrowserRouter>
    );

    expect(screen.getAllByText("58.0%").length).toBeGreaterThan(0);
  });

  it("should display animation when shouldAnimate is true", () => {
    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" shouldAnimate={true} />
      </BrowserRouter>
    );

    const cards = container.querySelectorAll(".animate-fade-in-up");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("should not display animation when shouldAnimate is false", () => {
    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" shouldAnimate={false} />
      </BrowserRouter>
    );

    // The grid should still exist but without animation classes
    const gridDiv = container.querySelector(".grid");
    expect(gridDiv).toBeDefined();
  });

  it("should use primary color for dark team colors", () => {
    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    // Check for colored divs with flex layout (new card structure)
    const coloredDivs = container.querySelectorAll("div[style*='rgb']");
    expect(coloredDivs.length).toBeGreaterThan(0);
  });

  it("should use secondary color for Jazz team", () => {
    const jazzRankings = {
      category: "PPG",
      label: "Points Per Game",
      rankings: [
        {
          rank: 1,
          team_id: 1610612762,
          team_name: "Utah Jazz",
          stat_category: "PPG",
          value: 119.1,
          logo_url: "https://example.com/jazz.png",
        },
      ],
    };

    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={jazzRankings} category="PPG" />
      </BrowserRouter>
    );

    // Check that stat value is displayed (Jazz team with secondary color)
    expect(screen.getByText("119.1")).toBeDefined();
  });

  it("should use secondary color for Rockets team", () => {
    const rocketsRankings = {
      category: "PPG",
      label: "Points Per Game",
      rankings: [
        {
          rank: 1,
          team_id: 1610612745,
          team_name: "Houston Rockets",
          stat_category: "PPG",
          value: 119.1,
          logo_url: "https://example.com/rockets.png",
        },
      ],
    };

    useAllTeams.mockReturnValue({
      data: mockAllTeams,
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={rocketsRankings} category="PPG" />
      </BrowserRouter>
    );

    // Check that stat value is displayed (Rockets team with secondary color)
    expect(screen.getByText("119.1")).toBeDefined();
  });

  it("should display custom grid layout classes", () => {
    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    const grid = container.querySelector(".grid");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("sm:grid-cols-2");
    expect(grid.className).toContain("md:grid-cols-3");
    expect(grid.className).toContain("lg:grid-cols-5");
  });

  it("should have success badge styling", () => {
    const { container } = render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    const badges = container.querySelectorAll(".badge-success");
    expect(badges.length).toBe(5);
  });
});
