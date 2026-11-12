import { useEffect, useState } from "react";
import { useCurrentSeason } from "../hooks/useApi";

// After this long without a response we assume the free-tier API is waking from idle.
export const SLOW_LOAD_MS = 3000;

// Renders children once the current season has loaded; shows loading/error state until then.
export function SeasonGate({ children }) {
  const { data: season, isLoading, error, refetch } = useCurrentSeason();

  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center min-h-screen text-center px-4">
        <div className="loading loading-spinner loading-lg"></div>
        {slow && (
          <p role="status">
            Waking up the server, this can take up to a minute after a quiet period...
          </p>
        )}
      </div>
    );
  }

  if (error || !season) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert alert-error shadow-lg">
          <span>Unable to load the current season. Please try again.</span>
          <button className="btn btn-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return children;
}
