import { useEffect } from "react";

export const BASE_TITLE = "NBA Top Five In";

/**
 * Sets the browser tab title to "NBA Top Five In | <suffix>", or just the base
 * title when suffix is empty (e.g. Rankings, or a team that has not loaded).
 * Resets to the base title on unmount.
 */
export function usePageTitle(suffix) {
  useEffect(() => {
    document.title = suffix ? `${BASE_TITLE} | ${suffix}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [suffix]);
}
