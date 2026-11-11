import { useCurrentSeason } from "../hooks/useApi";

// Renders children once the current season has loaded; shows loading/error state until then.
export function SeasonGate({ children }) {
  const { data: season, isLoading, error, refetch } = useCurrentSeason();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
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
