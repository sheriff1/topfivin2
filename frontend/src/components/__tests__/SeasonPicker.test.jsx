import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient, useCurrentSeason } from "../../hooks/useApi";
import { SeasonPicker } from "../SeasonPicker";

function renderWithClient(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function Shown() {
  const { data } = useCurrentSeason();
  return <div data-testid="shown">{data}</div>;
}

describe("SeasonPicker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("renders nothing when only one season is stored", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { current: "2026", available: ["2026"] },
    });
    renderWithClient(
      <>
        <SeasonPicker />
        <Shown />
      </>
    );
    await waitFor(() => expect(screen.getByTestId("shown")).toHaveTextContent("2026"));
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("lists stored seasons, defaults to the latest and switches the shown season", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { current: "2026", available: ["2026", "2025"] },
    });
    renderWithClient(
      <>
        <SeasonPicker />
        <Shown />
      </>
    );

    const select = await screen.findByRole("combobox", { name: "Season" });
    expect(select).toHaveValue("2026");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["2026-27", "2025-26"]);

    fireEvent.change(select, { target: { value: "2025" } });
    await waitFor(() => expect(screen.getByTestId("shown")).toHaveTextContent("2025"));
    expect(localStorage.getItem("selectedSeason")).toBe("2025");

    // Picking the latest season again goes back to following the latest
    fireEvent.change(select, { target: { value: "2026" } });
    await waitFor(() => expect(screen.getByTestId("shown")).toHaveTextContent("2026"));
    expect(localStorage.getItem("selectedSeason")).toBeNull();
  });
});
