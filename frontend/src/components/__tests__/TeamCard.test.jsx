import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { TeamCard } from "../TeamCard";

// Mock the useApi hook
vi.mock("../../hooks/useApi", () => ({
  useTeamRankings: vi.fn(),
}));

import { useTeamRankings } from "../../hooks/useApi";

describe("TeamCard Component", () => {
  const mockTeam = {
    team_id: 1610612751,
    team_name: "Brooklyn Nets",
    logo_url: "https://example.com/nets.png",
    team_colors: {
      primary: "#000000",
      secondary: "#FFFFFF",
    },
  };

  const mockRankingsData = {
    rankings: [
      { rank: 1, stat_category: "PPG", value: 115.4 },
      { rank: 3, stat_category: "RPG", value: 44.2 },
      { rank: 8, stat_category: "APG", value: 28.5 },
      { rank: 12, stat_category: "SPG", value: 7.1 },
      { rank: 25, stat_category: "BPG", value: 5.2 },
    ],
  };

  beforeEach(() => {
    useTeamRankings.mockReturnValue({
      data: mockRankingsData,
      isLoading: false,
      error: null,
    });
  });

  it("should render team card with team name", () => {
    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} />
      </BrowserRouter>
    );

    expect(screen.getByText("Brooklyn Nets")).toBeDefined();
  });

  it("should render team logo image when available", () => {
    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} />
      </BrowserRouter>
    );

    const logo = screen.getByAltText("Brooklyn Nets");
    expect(logo).toBeDefined();
    expect(logo.src).toContain("nets.png");
  });

  it("should calculate and display trophy count for top 5 teams", () => {
    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} />
      </BrowserRouter>
    );

    // Trophy count should be 2 (ranks 1 and 3 are <= 5)
    expect(screen.getByText("×2")).toBeDefined();
  });

  it("should handle zero trophy count when no top 5 rankings", () => {
    useTeamRankings.mockReturnValue({
      data: { rankings: [{ rank: 10 }, { rank: 20 }] },
      isLoading: false,
      error: null,
    });

    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} />
      </BrowserRouter>
    );

    expect(screen.getByText("×0")).toBeDefined();
  });

  it("should render trophy emoji", () => {
    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} />
      </BrowserRouter>
    );

    const emoji = screen.getByText("🏆");
    expect(emoji).toBeDefined();
  });

  it("should have link to team detail page", () => {
    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} />
      </BrowserRouter>
    );

    const link = screen.getByRole("link");
    expect(link.href).toContain("/team/BKN");
  });

  it("should use primary color for dark colors", () => {
    const darkColorTeam = {
      ...mockTeam,
      team_colors: {
        primary: "#000000", // Very dark=black
        secondary: "#FFFFFF",
      },
    };

    const { container } = render(
      <BrowserRouter>
        <TeamCard team={darkColorTeam} />
      </BrowserRouter>
    );

    const colorDiv = container.querySelector(".aspect-video");
    expect(colorDiv).toBeDefined();
    expect(colorDiv.style.backgroundColor).toBe("rgb(0, 0, 0)");
  });

  it("should use secondary color for light colors", () => {
    const lightColorTeam = {
      ...mockTeam,
      team_colors: {
        primary: "#FFFFFF", // Very light
        secondary: "#000000",
      },
    };

    const { container } = render(
      <BrowserRouter>
        <TeamCard team={lightColorTeam} />
      </BrowserRouter>
    );

    const colorDiv = container.querySelector(".aspect-video");
    expect(colorDiv).toBeDefined();
    // Secondary color should be used
    expect(colorDiv.style.backgroundColor).toBe("rgb(0, 0, 0)");
  });

  it("should always use secondary color for Jazz", () => {
    const jazzTeam = {
      ...mockTeam,
      team_id: 1610612762,
      team_name: "Utah Jazz",
      team_colors: {
        primary: "#000000",
        secondary: "#00471B",
      },
    };

    const { container } = render(
      <BrowserRouter>
        <TeamCard team={jazzTeam} />
      </BrowserRouter>
    );

    const colorDiv = container.querySelector(".aspect-video");
    expect(colorDiv).toBeDefined();
    // Should use secondary (green)
    expect(colorDiv.style.backgroundColor).toMatch(/rgb\(0,?\s*71,?\s*27\)|#00471B/i);
  });

  it("should always use secondary color for Rockets", () => {
    const rocketsTeam = {
      ...mockTeam,
      team_id: 1610612745,
      team_name: "Houston Rockets",
      team_colors: {
        primary: "#CE1141",
        secondary: "#000000",
      },
    };

    const { container } = render(
      <BrowserRouter>
        <TeamCard team={rocketsTeam} />
      </BrowserRouter>
    );

    const colorDiv = container.querySelector(".aspect-video");
    expect(colorDiv).toBeDefined();
    // Should use secondary (black)
    expect(colorDiv.style.backgroundColor).toBe("rgb(0, 0, 0)");
  });

  it("should handle empty rankings data", () => {
    useTeamRankings.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} />
      </BrowserRouter>
    );

    expect(screen.getByText("×0")).toBeDefined();
  });

  it("should map team_id to correct abbreviation", () => {
    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} />
      </BrowserRouter>
    );

    const link = screen.getByRole("link");
    expect(link.href).toContain("BKN"); // Brooklyn Nets abbreviation
  });

  it("should have card styling classes", () => {
    const { container } = render(
      <BrowserRouter>
        <TeamCard team={mockTeam} />
      </BrowserRouter>
    );

    const cardDiv = container.querySelector(".card");
    expect(cardDiv).toBeDefined();
    expect(cardDiv.className).toContain("shadow-md");
    expect(cardDiv.className).toContain("hover:shadow-lg");
  });
});
