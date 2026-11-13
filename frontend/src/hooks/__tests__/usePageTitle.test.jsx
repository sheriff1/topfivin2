import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { usePageTitle } from "../usePageTitle";

describe("usePageTitle", () => {
  beforeEach(() => {
    document.title = "NBA Top Five In";
  });

  it("sets 'NBA Top Five In | <suffix>'", () => {
    renderHook(() => usePageTitle("Teams"));
    expect(document.title).toBe("NBA Top Five In | Teams");
  });

  it("uses the base title when suffix is empty or undefined", () => {
    renderHook(() => usePageTitle());
    expect(document.title).toBe("NBA Top Five In");
    renderHook(() => usePageTitle(null));
    expect(document.title).toBe("NBA Top Five In");
  });

  it("updates when the suffix changes", () => {
    const { rerender } = renderHook(({ s }) => usePageTitle(s), { initialProps: { s: undefined } });
    expect(document.title).toBe("NBA Top Five In");
    rerender({ s: "Indiana Pacers" });
    expect(document.title).toBe("NBA Top Five In | Indiana Pacers");
  });

  it("resets to the base title on unmount", () => {
    const { unmount } = renderHook(() => usePageTitle("About"));
    unmount();
    expect(document.title).toBe("NBA Top Five In");
  });
});
