import { useState } from "react";
import { TeamCard } from "../components/TeamCard";
import { useAllTeams } from "../hooks/useApi";

export function TeamsPage() {
  const { data: teams, isLoading, error } = useAllTeams();
  const [sortOrder, setSortOrder] = useState("alpha");

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

  const sortedTeams = teams
    ? [...teams].sort((a, b) =>
        sortOrder === "trophies"
          ? b.trophy_count - a.trophy_count
          : a.team_name.localeCompare(b.team_name)
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-base-content/70 mt-2">Explore team stats and rankings</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            className={`btn btn-sm flex-1 sm:flex-initial ${
              sortOrder === "alpha" ? "btn-primary" : "btn-ghost border border-base-300"
            }`}
            onClick={() => setSortOrder("alpha")}
          >
            Alphabetical
          </button>
          <button
            className={`btn btn-sm flex-1 sm:flex-initial ${
              sortOrder === "trophies" ? "btn-primary" : "btn-ghost border border-base-300"
            }`}
            onClick={() => setSortOrder("trophies")}
          >
            🏆 Most Top 5s
          </button>
        </div>
      </div>

      {/* Teams Grid - 4 cols on desktop, 2 on tablet, 1 on mobile */}
      <div key={sortOrder} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sortedTeams.map((team, index) => (
          <div
            key={team.team_id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <TeamCard team={team} />
          </div>
        ))}
      </div>
    </div>
  );
}
