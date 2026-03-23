import { useAllTeams } from "../hooks/useApi";
import { formatStatValue, formatPercentageStat } from "../utils/statFormatter";

// Team ID to abbreviation mapping for routing
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

export function Top5Showcase({ rankings, _category, shouldAnimate = true }) {
  const { data: allTeams } = useAllTeams();
  if (!rankings || !rankings.rankings || rankings.rankings.length === 0) {
    return null;
  }

  // Get top 5 teams
  const top5 = rankings.rankings.slice(0, 5);

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

  // Choose card color: primary if contrast is good, else secondary
  // Special case: Jazz and Rockets use secondary color
  const getCardColor = (team) => {
    // Look up team colors from the allTeams data
    const teamData = allTeams?.find((t) => t.team_id === team.team_id);
    if (!teamData?.team_colors) return "#000000";

    const primaryColor = teamData.team_colors.primary || "#000000";
    const secondaryColor = teamData.team_colors.secondary || "#FFFFFF";

    // Jazz (1610612762) and Rockets (1610612745) always use secondary color
    if (team.team_id === 1610612762 || team.team_id === 1610612745) {
      return secondaryColor;
    }

    // Luminance < 0.5 is dark enough for white text
    const contrastRatio = getContrastRatio(primaryColor);
    return contrastRatio < 0.5 ? primaryColor : secondaryColor;
  };

  return (
    <div className="mb-8">
      <h3 className="text-xl font-bold mb-4">Top 5 Teams</h3>

      {/* Responsive grid: 5 cols → 3 cols → 2 cols → 1 col */}
      <div
        className={`grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 transition-all duration-300 ${shouldAnimate ? "opacity-100 translate-y-0" : "opacity-100 translate-y-0"}`}
      >
        {top5.map((team, index) => {
          const abbreviation = TEAM_ID_TO_ABBR[team.team_id];
          const backgroundColor = getCardColor(team);

          return (
            <div
              key={`${team.team_id}-${team.stat_category}`}
              className={`card shadow-lg hover:shadow-xl transition-shadow overflow-hidden flex flex-col h-full ${
                shouldAnimate ? "animate-fade-in-up" : ""
              }`}
              style={{
                animationDelay: shouldAnimate ? `${index * 50}ms` : "0ms",
              }}
            >
              {/* Top section: Logo on left, abbreviation on right */}
              <div
                className="flex items-center flex-1 relative overflow-hidden"
                style={{ backgroundColor }}
              >
                {/* Logo (as background, center-cropped, edge-to-edge) on left */}
                <div
                  className="w-1/2 h-full"
                  style={{
                    backgroundImage: `url(${team.logo_url})`,
                    backgroundSize: "150%",
                    backgroundPosition: "center",
                  }}
                />

                {/* Team abbreviation on right with League Gothic */}
                <div className="w-1/2 h-full flex items-center justify-center">
                  <span
                    className="text-7xl font-bold text-white leading-none"
                    style={{
                      fontFamily: '"League Gothic", sans-serif',
                      letterSpacing: "0",
                    }}
                  >
                    {abbreviation}
                  </span>
                </div>

                {/* Rank badge */}
                <div className="absolute top-2 right-2">
                  <span className="badge badge-success font-bold text-sm">#{team.rank}</span>
                </div>
              </div>

              {/* Bottom section: Stat value in white area */}
              <div className="bg-white px-4 py-4 text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {["TS%", "ORB%", "DRB%", "TRB%", "AST%", "USG%"].includes(rankings.category)
                    ? formatPercentageStat(team.value, rankings.label)
                    : formatStatValue(team.value, rankings.label)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom animation styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
