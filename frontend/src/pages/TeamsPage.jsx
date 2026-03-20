import { TeamCard } from "../components/TeamCard";
import { useAllTeams } from "../hooks/useApi";

export function TeamsPage() {
  const { data: teams, isLoading, error } = useAllTeams();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <div>
          <span>Failed to load teams: {error.message}</span>
        </div>
      </div>
    );
  }

  // Sort teams alphabetically
  const sortedTeams = teams
    ? [...teams].sort((a, b) => a.team_name.localeCompare(b.team_name))
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Teams</h1>
        <p className="text-base-content/70 mt-2">Explore team stats and rankings</p>
      </div>

      {/* Teams Grid - 4 cols on desktop, 2 on tablet, 1 on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sortedTeams.map((team) => (
          <TeamCard key={team.team_id} team={team} />
        ))}
      </div>
    </div>
  );
}
