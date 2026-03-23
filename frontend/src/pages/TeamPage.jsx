import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useTeamByAbbreviation,
  useTeamStats,
  useTeamRankings,
  useCategories,
} from "../hooks/useApi";
import { formatStatValue, formatPercentageStat } from "../utils/statFormatter";

// Helper function to format category label for display
const getFormattedCategoryLabel = (label) => {
  if (!label) return label;
  // Replace "Avg " with "Average "
  let formatted = label.replace(/^Avg /i, "Average ");
  // Remove "(mins)" suffix
  formatted = formatted.replace(/\s*\(mins\)\s*$/i, "");
  return formatted;
};

export function TeamPage() {
  const { abbreviation } = useParams();
  const { data: team, isLoading: teamLoading } = useTeamByAbbreviation(abbreviation);
  const { data: stats, isLoading: statsLoading } = useTeamStats(team?.team_id, "2025");
  const { data: rankings, isLoading: rankingsLoading } = useTeamRankings(team?.team_id, "2025");
  const { data: categories } = useCategories();

  // Sorting state - default to "category" ascending (A->Z)
  const [sortColumn, setSortColumn] = useState("category");
  const [sortDirection, setSortDirection] = useState("asc");

  const isLoading = teamLoading || statsLoading || rankingsLoading;

  // Calculate contrast ratio for white text on a given hex color
  const getContrastRatio = (hexColor) => {
    // Convert hex to RGB
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return contrast ratio with white (255, 255, 255)
    // Higher values mean lighter background (less contrast with white text)
    return luminance;
  };

  // Choose header color: primary if contrast is good, else secondary
  // Special case: Jazz and Rockets use secondary color
  const getHeaderColor = () => {
    if (!team?.team_colors) return "#000000";

    const primaryColor = team.team_colors.primary || "#000000";
    const secondaryColor = team.team_colors.secondary || "#FFFFFF";

    // Jazz (1610612762) and Rockets (1610612745) always use secondary color
    if (team.team_id === 1610612762 || team.team_id === 1610612745) {
      return secondaryColor;
    }

    // Luminance < 0.5 is dark enough for white text (good contrast)
    const contrastRatio = getContrastRatio(primaryColor);
    return contrastRatio < 0.5 ? primaryColor : secondaryColor;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="alert alert-error">
        <div>
          <span>Team not found: {abbreviation}</span>
        </div>
      </div>
    );
  }

  // Create a mapping of category code to rank info
  const rankingsByCategory = (rankings?.rankings || []).reduce((acc, r) => {
    acc[r.stat_category] = r;
    return acc;
  }, {});

  // Handle sort column click
  const handleSortClick = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Switch column and reset to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get sorted categories based on sort state
  const getSortedCategories = () => {
    if (!categories) return [];

    const sorted = [...categories];

    if (sortColumn === "category") {
      sorted.sort((a, b) => {
        const comparison = a.label.localeCompare(b.label);
        return sortDirection === "asc" ? comparison : -comparison;
      });
    } else if (sortColumn === "rank") {
      sorted.sort((a, b) => {
        const rankA = rankingsByCategory[a.code]?.rank ?? Infinity;
        const rankB = rankingsByCategory[b.code]?.rank ?? Infinity;
        const comparison = rankA - rankB;
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return sorted;
  };

  const sortedCategories = getSortedCategories();

  // Get sort indicator icon
  const getSortIndicator = (column) => {
    if (sortColumn !== column) return "";
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  // Get rankings by rank position
  const getRankingsByPosition = (rankPosition) => {
    if (!rankings?.rankings || !categories) return [];
    return rankings.rankings
      .filter((r) => r.rank === rankPosition)
      .map((r) => {
        const category = categories.find((c) => c.code === r.stat_category);
        return {
          ...r,
          label: category?.label || r.stat_category,
        };
      });
  };

  const firstPlaceRankings = getRankingsByPosition(1);
  const secondPlaceRankings = getRankingsByPosition(2);
  const thirdPlaceRankings = getRankingsByPosition(3);

  // Get stat value from stats object and format it
  const getFormattedStatValue = (category) => {
    if (!stats) return "-";

    const statMap = {
      PPG: stats.pts_avg,
      RPG: stats.reb_avg,
      APG: stats.ast_avg,
      SPG: stats.stl_avg,
      BPG: stats.blk_avg,
      "FG%": stats.fg_pct,
      "3P%": stats.three_p_pct,
      "FT%": stats.ft_pct,
      "TS%": stats.ts_pct,
      "ORB%": stats.orb_pct,
      "DRB%": stats.drb_pct,
      "TRB%": stats.trb_pct,
      "AST%": stats.ast_pct,
      "USG%": stats.usg_pct,
      "TOV%": stats.tov_pct,
    };

    const value = statMap[category];
    if (value === null || value === undefined) return "-";

    // Get the category label to determine formatting
    const categoryLabel = categories?.find((c) => c.code === category)?.label || category;
    const formattedLabel = getFormattedCategoryLabel(categoryLabel);

    // Use formatPercentageStat for advanced percentages, formatStatValue for others
    if (["TS%", "ORB%", "DRB%", "TRB%", "AST%", "USG%"].includes(category)) {
      return formatPercentageStat(value, formattedLabel);
    }
    return formatStatValue(value, formattedLabel);
  };

  // Get badge styling based on rank
  const getRankBadgeColor = (rank) => {
    if (rank <= 5) return "badge-success"; // Top 5
    if (rank <= 15) return "badge-warning"; // Top 15
    return "badge-error"; // Beyond top 15
  };

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div
        className="card shadow-md"
        style={{
          backgroundColor: getHeaderColor(),
          color: "white",
        }}
      >
        <div className="card-body">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              {team.logo_url && (
                <img
                  src={team.logo_url}
                  alt={team.team_name}
                  className="h-24 w-24 object-contain"
                />
              )}
              <div>
                <h1 className="text-4xl font-bold text-white">{team.team_name}</h1>
              </div>
            </div>
            <div className="flex items-center gap-1 text-2xl">
              <span>🏆</span>
              <span className="font-semibold text-white">
                ×{(rankings?.rankings || []).filter((r) => r.rank <= 5).length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Rankings Table */}
      <div className="card bg-base-200 shadow-md">
        <div className="card-body">
          <h2 className="card-title mb-4">Season Stats & Rankings (2025)</h2>

          {/* Top 3 Banners */}
          <div className="mb-4 space-y-2">
            {/* 1st Place Banner */}
            {firstPlaceRankings.length > 0 && (
              <div className="alert bg-yellow-100 border-l-4 border-yellow-400 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">🥇</span>
                  <span className="font-semibold text-yellow-800">
                    1st place in:{" "}
                    {firstPlaceRankings.map((r) => getFormattedCategoryLabel(r.label)).join(", ")}
                  </span>
                </div>
              </div>
            )}

            {/* 2nd Place Banner */}
            {secondPlaceRankings.length > 0 && (
              <div className="alert bg-gray-100 border-l-4 border-gray-400 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">🥈</span>
                  <span className="font-semibold text-gray-800">
                    2nd place in:{" "}
                    {secondPlaceRankings.map((r) => getFormattedCategoryLabel(r.label)).join(", ")}
                  </span>
                </div>
              </div>
            )}

            {/* 3rd Place Banner */}
            {thirdPlaceRankings.length > 0 && (
              <div className="alert bg-amber-50 border-l-4 border-amber-600 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">🥉</span>
                  <span className="font-semibold text-amber-900">
                    3rd place in:{" "}
                    {thirdPlaceRankings.map((r) => getFormattedCategoryLabel(r.label)).join(", ")}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th
                    className="w-1/3 cursor-pointer hover:bg-base-300"
                    onClick={() => handleSortClick("category")}
                  >
                    Stat Category{getSortIndicator("category")}
                  </th>
                  <th
                    className="text-right cursor-pointer hover:bg-base-300"
                    onClick={() => handleSortClick("rank")}
                  >
                    Rank{getSortIndicator("rank")}
                  </th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories?.map((category) => {
                  const ranking = rankingsByCategory[category.code];
                  const isTrophy = ranking?.rank <= 5;

                  return (
                    <tr key={category.code}>
                      <td>
                        <div className="flex items-center gap-2">
                          {getFormattedCategoryLabel(category.label)}
                          {isTrophy && <span className="text-xl">🏆</span>}
                        </div>
                      </td>
                      <td className="text-right">
                        {ranking ? (
                          <div className={`badge ${getRankBadgeColor(ranking.rank)}`}>
                            #{ranking.rank}
                          </div>
                        ) : (
                          <span className="text-base-content/50">-</span>
                        )}
                      </td>
                      <td className="text-right font-semibold">
                        {ranking
                          ? ["TS%", "ORB%", "DRB%", "TRB%", "AST%", "USG%"].includes(category.code)
                            ? formatPercentageStat(
                                ranking.value,
                                getFormattedCategoryLabel(category.label)
                              )
                            : formatStatValue(
                                ranking.value,
                                getFormattedCategoryLabel(category.label)
                              )
                          : getFormattedStatValue(category.code)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
