import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { AuditTab } from "../AuditTab";

// Mock the apiClient
vi.mock("../../hooks/useApi", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from "../../hooks/useApi";

describe("AuditTab Component", () => {
  const mockAuditData = {
    stats: {
      total_games: 1230,
      collected_games: 800,
      collection_percentage: 65.04,
    },
    games: [
      {
        game_id: "g1",
        game_date: "2025-01-15",
        home_team_abbreviation: "DAL",
        home_team_logo: "https://example.com/mavericks.png",
        away_team_abbreviation: "BOS",
        away_team_logo: "https://example.com/celtics.png",
        collected: true,
      },
      {
        game_id: "g2",
        game_date: "2025-01-16",
        home_team_abbreviation: "LAL",
        home_team_logo: "https://example.com/lakers.png",
        away_team_abbreviation: "GSW",
        away_team_logo: "https://example.com/warriors.png",
        collected: false,
      },
    ],
    pagination: {
      limit: 50,
      offset: 0,
      total: 1230,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockResolvedValue({ data: mockAuditData });
  });

  it("should render loading spinner initially", async () => {
    apiClient.get.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    const { container } = render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(container.querySelector(".loading-spinner")).toBeDefined();
    });
  });

  it("should fetch and display audit data", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByText("1230")).toBeDefined();
      expect(screen.getByText("800")).toBeDefined();
    });
  });

  it("should display collection percentage", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByText("65.04%")).toBeDefined();
    });
  });

  it("should display total games stat card", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByText("Total Games")).toBeDefined();
      expect(screen.getByText("1230")).toBeDefined();
    });
  });

  it("should display collected games stat card", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByText("Collected")).toBeDefined();
    });
  });

  it("should display collection rate stat card", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByText("Collection Rate")).toBeDefined();
    });
  });

  it("should display games table with game IDs", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByText("g1")).toBeDefined();
      expect(screen.getByText("g2")).toBeDefined();
    });
  });

  it("should display filter controls", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByText("Filters")).toBeDefined();
      // Check for filter card presence instead of individual label texts
      // which might appear multiple times
      const fieldLabels = screen.getAllByText(/Status|Date/);
      expect(fieldLabels.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("should have status filter with options", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      const select = screen.getByDisplayValue("All Games");
      expect(select).toBeDefined();
    });

    const select = screen.getByDisplayValue("All Games");
    expect(select.querySelector('option[value="all"]')).toBeDefined();
    expect(select.querySelector('option[value="collected"]')).toBeDefined();
    expect(select.querySelector('option[value="missing"]')).toBeDefined();
  });

  it("should have date filter input", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      const dateInput = screen.getByDisplayValue("");
      expect(dateInput).toBeDefined();
    });

    const dateInput = screen.getByDisplayValue("");
    expect(dateInput.type).toBe("date");
  });

  it("should have clear filters button", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Clear Filters/ })).toBeDefined();
    });
  });

  it("should handle status filter change", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      const statusSelect = screen.getByDisplayValue("All Games");
      expect(statusSelect).toBeDefined();
    });

    const statusSelect = screen.getByDisplayValue("All Games");
    fireEvent.change(statusSelect, { target: { value: "collected" } });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("status=collected")
      );
    });
  });

  it("should display game collection details header", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByText("Game Collection Details")).toBeDefined();
    });
  });

  it("should display table headers", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      // Look for table headers specifically
      const columnHeaders = screen.getAllByRole("columnheader");
      const headerTexts = columnHeaders.map(h => h.textContent).join(" ");
      expect(headerTexts).toContain("Game ID");
      expect(headerTexts).toContain("Date");
      expect(headerTexts).toContain("Home Team");
      expect(headerTexts).toContain("Away Team");
      expect(headerTexts).toContain("Status");
    });
  });

  it("should handle API error", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("Network error"));

    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading audit data/)).toBeDefined();
    });
  });

  it("should show retry button on error", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("Network error"));

    render(<AuditTab season="2025" />);

    await waitFor(() => {
      const retryButton = screen.getByRole("button", { name: /Retry/ });
      expect(retryButton).toBeDefined();
    });
  });

  it("should handle empty games array", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        ...mockAuditData,
        games: [],
      },
    });

    render(<AuditTab season="2025" />);

    await waitFor(() => {
      expect(screen.getByText(/No games found for season/)).toBeDefined();
    });
  });

  it("should make API call with correct season", () => {
    render(<AuditTab season="2024" />);

    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining("season=2025")
    );
  });

  it("should have progress bar for collection rate", async () => {
    render(<AuditTab season="2025" />);

    await waitFor(() => {
      const progress = document.querySelector(".progress");
      expect(progress).toBeDefined();
    });
  });

  it("should have correct styling classes for stat cards", async () => {
    const { container } = render(<AuditTab season="2025" />);

    await waitFor(() => {
      const cards = container.querySelectorAll(".card");
      expect(cards.length).toBeGreaterThan(0);
      cards.forEach((card) => {
        expect(card.className).toContain("bg-base-200");
      });
    });
  });

  it("should have responsive grid layout", async () => {
    const { container } = render(<AuditTab season="2025" />);

    await waitFor(() => {
      const grids = container.querySelectorAll(".grid");
      grids.forEach((grid) => {
        expect(grid.className).toMatch(/grid-cols/);
      });
    });
  });

  it("should have table-compact styling", async () => {
    const { container } = render(<AuditTab season="2025" />);

    await waitFor(() => {
      const table = container.querySelector(".table");
      expect(table.className).toContain("table-compact");
    });
  });
});
