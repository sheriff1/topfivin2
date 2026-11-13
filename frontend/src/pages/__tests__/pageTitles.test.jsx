import { render, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../hooks/useApi", () => ({
  useAllTeams: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useTeamByAbbreviation: vi.fn(),
  useTeamStats: vi.fn(() => ({ data: null, isLoading: false })),
  useTeamRankings: vi.fn(() => ({ data: null, isLoading: false })),
  useCategories: vi.fn(() => ({ data: null, isLoading: false })),
  useCurrentSeason: vi.fn(() => ({ data: "2025", isLoading: false, error: null })),
}));

import { useTeamByAbbreviation } from "../../hooks/useApi";
import { AboutPage } from "../AboutPage";
import { TeamPage } from "../TeamPage";
import { TeamsPage } from "../TeamsPage";

const renderTeam = (abbr) =>
  render(
    <MemoryRouter initialEntries={[`/team/${abbr}`]}>
      <Routes>
        <Route path="/team/:abbreviation" element={<TeamPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("Page titles", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    document.title = "NBA Top Five In";
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("TeamsPage sets 'Teams'", () => {
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>
    );
    expect(document.title).toBe("NBA Top Five In | Teams");
  });

  it("AboutPage sets 'About' and resets on unmount", () => {
    const { unmount } = render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );
    expect(document.title).toBe("NBA Top Five In | About");
    unmount();
    expect(document.title).toBe("NBA Top Five In");
  });

  it("TeamPage keeps the base title while loading", () => {
    useTeamByAbbreviation.mockReturnValue({ data: undefined, isLoading: true });
    renderTeam("IND");
    expect(document.title).toBe("NBA Top Five In");
  });

  it("TeamPage uses the team name once loaded", () => {
    useTeamByAbbreviation.mockReturnValue({
      data: { team_id: 1, team_name: "Indiana Pacers", team_colors: {} },
      isLoading: false,
    });
    renderTeam("IND");
    expect(document.title).toBe("NBA Top Five In | Indiana Pacers");
  });

  it("TeamPage falls back to the base title for an unknown abbreviation", () => {
    useTeamByAbbreviation.mockReturnValue({ data: null, isLoading: false });
    renderTeam("XXX");
    expect(document.title).toBe("NBA Top Five In");
  });
});
