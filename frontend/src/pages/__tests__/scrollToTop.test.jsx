import { render, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all API hooks used by pages
vi.mock("../../hooks/useApi", () => ({
  useAllTeams: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useTeamByAbbreviation: vi.fn(() => ({ data: null, isLoading: true })),
  useTeamStats: vi.fn(() => ({ data: null, isLoading: true })),
  useTeamRankings: vi.fn(() => ({ data: null, isLoading: true })),
  useCategories: vi.fn(() => ({ data: null, isLoading: true })),
  useRankings: vi.fn(() => ({ data: null, isLoading: false })),
  useRandomFacts: vi.fn(() => ({ data: null, isLoading: false })),
  useApiHealth: vi.fn(() => ({ data: null, isLoading: false })),
  CURRENT_SEASON: "2025",
}));

import { AboutPage } from "../AboutPage";
import { TeamPage } from "../TeamPage";
import { TeamsPage } from "../TeamsPage";

describe("Scroll to top on page navigation", () => {
  let scrollToSpy;

  beforeEach(() => {
    scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    scrollToSpy.mockRestore();
    cleanup();
  });

  it("TeamsPage scrolls to top on mount", () => {
    render(
      <MemoryRouter initialEntries={["/teams"]}>
        <TeamsPage />
      </MemoryRouter>
    );

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it("AboutPage scrolls to top on mount", () => {
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <AboutPage />
      </MemoryRouter>
    );

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it("TeamPage scrolls to top on mount", () => {
    render(
      <MemoryRouter initialEntries={["/team/BOS"]}>
        <Routes>
          <Route path="/team/:abbreviation" element={<TeamPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });
});
