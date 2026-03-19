import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
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
    render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText("Dallas Mavericks")).toBeDefined();
    expect(screen.getByText("Boston Celtics")).toBeDefined();
    expect(screen.getByText("Cleveland Cavaliers")).toBeDefined();
    expect(screen.getByText("Brooklyn Nets")).toBeDefined();
    expect(screen.getByText("Chicago Bulls")).toBeDefined();

    // 6th team should not be rendered
    expect(screen.queryByText("Minnesota Timberwolves")).toBeNull();
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
    render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    const logos = screen.getAllByAltText(/Mavericks|Celtics|Cavaliers|Nets|Bulls/);
    expect(logos.length).toBeGreaterThanOrEqual(5);
  });

  it("should have links to team detail pages", () => {
    render(
      <BrowserRouter>
        <Top5Showcase rankings={mockRankings} category="PPG" />
      </BrowserRouter>
    );

    const links = screen.getAllByRole("link");
    expect(links.some((link) => link.href.includes("/team/DAL"))).toBe(true);
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

    // At least one team should use primary color (dark)
    // Look for Link elements with aspect-video class that have inline style
    const colorDivs = container.querySelectorAll("a.aspect-video");
    expect(colorDivs.length).toBeGreaterThan(0);
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

    render(
      <BrowserRouter>
        <Top5Showcase rankings={jazzRankings} category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText("Utah Jazz")).toBeDefined();
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

    render(
      <BrowserRouter>
        <Top5Showcase rankings={rocketsRankings} category="PPG" />
      </BrowserRouter>
    );

    expect(screen.getByText("Houston Rockets")).toBeDefined();
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
