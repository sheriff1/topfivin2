import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../hooks/useApi", () => ({
  useCurrentSeason: vi.fn(() => ({ data: "2026", isLoading: false, error: null })),
  useDataStatus: vi.fn(),
}));

import { useDataStatus } from "../../hooks/useApi";
import { AboutPage } from "../AboutPage";

const renderAbout = () =>
  render(
    <MemoryRouter>
      <AboutPage />
    </MemoryRouter>
  );

describe("AboutPage data status", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows data-through date and last-fetched time when loaded", () => {
    useDataStatus.mockReturnValue({
      data: {
        season: "2026",
        latestGameDate: "2026-11-13",
        lastFetchedAt: "2026-11-14T09:30:00Z",
      },
      isLoading: false,
      isError: false,
    });
    renderAbout();
    const status = screen.getByTestId("data-status");
    expect(status).toHaveTextContent(/Data through:\s*Nov 13, 2026/);
    expect(status).toHaveTextContent(/Last fetched:\s*Nov 1[3-4], 2026/);
  });

  it("shows a loading message while fetching", () => {
    useDataStatus.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderAbout();
    expect(screen.getByText(/Loading data status/)).toBeInTheDocument();
  });

  it("shows an empty message when no data is stored", () => {
    useDataStatus.mockReturnValue({ data: null, isLoading: false, isError: false });
    renderAbout();
    expect(screen.getByText(/No game data has been stored yet/)).toBeInTheDocument();
    expect(screen.queryByTestId("data-status")).not.toBeInTheDocument();
  });

  it("shows an unavailable message on error without breaking the page", () => {
    useDataStatus.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderAbout();
    expect(screen.getByText(/Data status is unavailable/)).toBeInTheDocument();
    expect(screen.getByText("Update Frequency")).toBeInTheDocument();
  });

  it("shows Unknown for a value the API could not provide", () => {
    useDataStatus.mockReturnValue({
      data: { season: "2026", latestGameDate: "2026-11-13", lastFetchedAt: null },
      isLoading: false,
      isError: false,
    });
    renderAbout();
    expect(screen.getByTestId("data-status")).toHaveTextContent(/Last fetched:\s*Unknown/);
  });
});
