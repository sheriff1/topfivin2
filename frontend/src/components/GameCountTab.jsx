import PropTypes from "prop-types";
import { useState } from "react";
import { useRankings } from "../hooks/useApi";

export function GameCountTab({ season }) {
  // Use PPG category to get all teams with their games_count
  const [selectedCategory] = useState("PPG");
  const { data: rankings, isLoading: rankingsLoading } = useRankings(selectedCategory, season);

  const isLoading = rankingsLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  // Extract team games count from rankings data
  const teamGamesData = rankings?.rankings
    ? rankings.rankings
        .map((team) => ({
          team_id: team.team_id,
          team_name: team.team_name,
          logo_url: team.logo_url,
          games_count: team.games_count || 0,
        }))
        .sort((a, b) => a.team_name.localeCompare(b.team_name))
    : [];

  return (
    <div className="space-y-6">
      <div className="card bg-base-200 shadow-md">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-6">Games Count by Team</h2>

          <div className="overflow-x-auto">
            <table className="table table-striped w-full">
              <thead>
                <tr>
                  <th className="w-1/3">Team</th>
                  <th className="text-right">Games Collected</th>
                </tr>
              </thead>
              <tbody>
                {teamGamesData.map((team) => (
                  <tr key={team.team_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {team.logo_url && (
                          <img
                            src={team.logo_url}
                            alt={team.team_name}
                            className="h-8 w-8 object-contain"
                          />
                        )}
                        <span className="font-medium">{team.team_name}</span>
                      </div>
                    </td>
                    <td className="text-right font-semibold text-lg">{team.games_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Card */}
          <div className="mt-6 p-4 bg-base-100 rounded-lg border border-base-300">
            <div className="text-sm text-base-content/70">
              <p>
                <strong>Total Season Games:</strong>{" "}
                {teamGamesData.reduce((sum, team) => sum + team.games_count, 0) / 2} games
              </p>
              <p className="mt-2 text-xs">
                (Divided by 2 since each game is counted for both home and away teams)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

GameCountTab.propTypes = {
  season: PropTypes.number.isRequired,
};
