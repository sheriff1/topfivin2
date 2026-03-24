import { Link } from "react-router-dom";
import { useRankings, useAllTeams } from "../hooks/useApi";
import { formatStatValue, formatPercentageStat } from "../utils/statFormatter";

const TEAM_ID_TO_ABBR = {
  1610612737: "ATL",
  1610612738: "BOS",
  1610612739: "CLE",
  1610612740: "NOP",
  1610612741: "CHI",
  1610612742: "DAL",
  1610612743: "DEN",
  1610612744: "GSW",
  1610612745: "HOU",
  1610612746: "LAC",
  1610612747: "LAL",
  1610612748: "MIA",
  1610612749: "MIL",
  1610612750: "MIN",
  1610612751: "BKN",
  1610612752: "NYK",
  1610612753: "ORL",
  1610612754: "IND",
  1610612755: "PHI",
  1610612756: "PHX",
  1610612757: "POR",
  1610612758: "SAC",
  1610612759: "SAS",
  1610612760: "OKC",
  1610612761: "TOR",
  1610612762: "UTA",
  1610612763: "MEM",
  1610612764: "WAS",
  1610612765: "DET",
  1610612766: "CHA",
};

export function RankingsGrid({ category, season = "2025" }) {
  const { data, isLoading, error } = useRankings(category, season);
  const { data: allTeams } = useAllTeams();

  // Calculate contrast ratio for white text on a given hex color
  const getContrastRatio = (hexColor) => {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance;
  };

  // Get team's primary or secondary color based on luminance
  const getTeamColor = (teamId) => {
    const teamData = allTeams?.find((t) => t.team_id === teamId);
    if (!teamData?.team_colors) return "#000000";

    const primaryColor = teamData.team_colors.primary || "#000000";
    const secondaryColor = teamData.team_colors.secondary || "#FFFFFF";

    // Jazz (1610612762) and Rockets (1610612745) always use secondary color
    if (teamId === 1610612762 || teamId === 1610612745) {
      return secondaryColor;
    }

    // Luminance < 0.5 is dark enough for white text
    const contrastRatio = getContrastRatio(primaryColor);
    return contrastRatio < 0.5 ? primaryColor : secondaryColor;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l-2-2m0 0l-2-2m2 2l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Error loading rankings: {error.message}</span>
      </div>
    );
  }

  if (!data || !data.rankings || data.rankings.length === 0) {
    return (
      <div className="alert alert-info">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>No data available for {category}</span>
      </div>
    );
  }

  const getRankColor = (rank) => {
    if (rank <= 5) return "badge-success";
    if (rank <= 15) return "badge-warning";
    return "badge-error";
  };

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th className="text-right">{data.label}</th>
          </tr>
        </thead>
        <tbody>
          {data.rankings.map((item) => (
            <tr key={`${item.team_id}-${item.stat_category}`} className="hover:bg-base-200 py-0">
              <td className="py-0">
                <span className={`badge badge-lg ${getRankColor(item.rank)}`}>#{item.rank}</span>
              </td>
              <td className="py-0">
                <Link to={`/team/${TEAM_ID_TO_ABBR[item.team_id]}`} className="link link-hover">
                  <div className="flex items-center gap-3">
                    {item.logo_url && (
                      <div
                        className="h-12 w-12 flex-shrink-0 overflow-hidden"
                        style={{
                          backgroundColor: getTeamColor(item.team_id),
                          backgroundImage: `url(${item.logo_url})`,
                          backgroundSize: "175%",
                          backgroundPosition: "center",
                        }}
                      />
                    )}
                    <div>{item.team_name}</div>
                  </div>
                </Link>
              </td>
              <td className="text-right text-lg font-bold py-0">
                {[
                  "TS%",
                  "ORB%",
                  "DRB%",
                  "TRB%",
                  "AST%",
                  "USG%",
                  // Scoring breakdown percentages from BoxScoreScoringV3
                  "PCT_FGA_2PT",
                  "PCT_FGA_3PT",
                  "PCT_PTS_2PT",
                  "PCT_PTS_2PT_MR",
                  "PCT_PTS_3PT",
                  "PCT_PTS_FB",
                  "PCT_PTS_FT",
                  "PCT_PTS_OFF_TOV",
                  "PCT_PTS_PAINT",
                  "PCT_AST_2PM",
                  "PCT_UAST_2PM",
                  "PCT_AST_3PM",
                  "PCT_UAST_3PM",
                  "PCT_AST_FGM",
                  "PCT_UAST_FGM",
                ].includes(data.category)
                  ? formatPercentageStat(item.value, data.label)
                  : formatStatValue(item.value, data.label)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
