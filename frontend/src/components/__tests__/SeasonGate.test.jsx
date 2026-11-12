import { render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../hooks/useApi", () => ({ useCurrentSeason: vi.fn() }));

import { useCurrentSeason } from "../../hooks/useApi";
import { SeasonGate, SLOW_LOAD_MS } from "../SeasonGate";

describe("SeasonGate", () => {
  afterEach(() => vi.useRealTimers());

  it("shows a spinner while loading", () => {
    useCurrentSeason.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<SeasonGate>child</SeasonGate>);
    expect(container.querySelector(".loading")).toBeInTheDocument();
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });

  it("shows a waking-up message only after a slow load", () => {
    vi.useFakeTimers();
    useCurrentSeason.mockReturnValue({ data: undefined, isLoading: true });
    render(<SeasonGate>child</SeasonGate>);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(SLOW_LOAD_MS + 1);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/Waking up/);
  });

  it("shows an error with retry when the season fails to load", () => {
    useCurrentSeason.mockReturnValue({ data: undefined, isLoading: false, error: new Error("x") });
    render(<SeasonGate>child</SeasonGate>);
    expect(screen.getByText(/Unable to load the current season/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders children once the season is loaded", () => {
    useCurrentSeason.mockReturnValue({ data: "2026", isLoading: false });
    render(<SeasonGate>child</SeasonGate>);
    expect(screen.getByText("child")).toBeInTheDocument();
  });
});
