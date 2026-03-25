import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RankingsPage } from "../RankingsPage";

// Mock all API hooks
vi.mock("../../hooks/useApi", () => ({
  useCategories: vi.fn(() => ({
    data: [{ code: "PPG", label: "Points Per Game" }],
    isLoading: false,
    error: null,
  })),
  useRankings: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useRandomFacts: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useAllTeams: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  CURRENT_SEASON: "2025",
}));

vi.mock("../../components/DidYouKnow", () => ({
  DidYouKnow: () => <div data-testid="did-you-know">Mock DidYouKnow</div>,
}));

vi.mock("../../components/RankingsGrid", () => ({
  RankingsGrid: () => <div data-testid="rankings-grid">Mock Grid</div>,
}));

vi.mock("../../components/Top5Showcase", () => ({
  Top5Showcase: () => <div data-testid="top5-showcase">Mock Showcase</div>,
}));

describe("RankingsPage", () => {
  let scrollToSpy;

  beforeEach(() => {
    scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  it("should render Surprise Me button with full-width on mobile classes", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <RankingsPage />
      </MemoryRouter>
    );

    const surpriseBtn = screen.getByRole("button", { name: /Surprise me/ });
    expect(surpriseBtn.className).toContain("w-full");
    expect(surpriseBtn.className).toContain("sm:w-auto");
  });

  it("should render View Rankings By Team button as btn-md", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <RankingsPage />
      </MemoryRouter>
    );

    const teamBtn = screen.getByRole("link", { name: /View Rankings By Team/ });
    expect(teamBtn.className).toContain("btn-md");
    expect(teamBtn.className).toContain("btn-primary");
  });
});
