import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  const prevTop5Ref = useRef(null);
  const [prevTop5, setPrevTop5] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Get top 5 teams
  const top5 =
    rankings && rankings.rankings && rankings.rankings.length > 0
      ? rankings.rankings.slice(0, 5)
      : [];

  // Track previous top5 for slide transition
  useEffect(() => {
    if (top5.length === 0) {
      return undefined;
    }

    if (shouldAnimate && prevTop5Ref.current) {
      setPrevTop5(prevTop5Ref.current);
      setIsAnimating(true);

      const timer = window.setTimeout(() => {
        setPrevTop5(null);
        setIsAnimating(false);
      }, 1000); // stagger (400ms) + animation (500ms) + buffer
      return () => window.clearTimeout(timer);
    }

    prevTop5Ref.current = top5;
    return undefined;
  }, [rankings]);

  // Update ref after animation starts (so next change has correct prev)
  useEffect(() => {
    if (top5.length > 0) {
      prevTop5Ref.current = top5;
    }
  }, [top5]);

  if (top5.length === 0) {
    return null;
  }

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

  // Renders the colored content (logo + abbreviation + badge) for a team
  const renderTeamContent = (team) => {
    const abbreviation = TEAM_ID_TO_ABBR[team.team_id];
    const backgroundColor = getCardColor(team);

    return (
      <div
        className="flex items-center w-full relative"
        style={{ backgroundColor, height: "100%" }}
      >
        <div
          className="w-1/2 h-full"
          style={{
            backgroundImage: `url(${team.logo_url})`,
            backgroundSize: "150%",
            backgroundPosition: "center",
          }}
        />
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
        <div className="absolute top-2 right-2">
          <span className="badge badge-success font-bold text-sm">#{team.rank}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mb-8">
      <h3 className="text-xl font-bold mb-4">Top 5 Teams</h3>

      {/* Responsive grid: 5 cols → 3 cols → 2 cols → 1 col */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 transition-all duration-300">
        {top5.map((team, index) => {
          const abbreviation = TEAM_ID_TO_ABBR[team.team_id];
          const prevTeam = prevTop5?.[index];
          const hasTransition = isAnimating && prevTeam;

          return (
            <Link key={`slot-${index}`} to={`/team/${abbreviation}`}>
              <div className="card shadow-lg hover:shadow-xl transition-shadow overflow-hidden flex flex-col h-full cursor-pointer">
                {/* Colored section container - clips the sliding content */}
                <div className="relative overflow-hidden z-0" style={{ height: "8rem" }}>
                  {hasTransition ? (
                    /* Sliding wrapper: old team on top, new team below */
                    <div
                      className="card-slide-transition"
                      style={{
                        height: "200%",
                        animationDelay: `${index * 100}ms`,
                      }}
                    >
                      {/* Previous team - top half */}
                      <div style={{ height: "50%" }}>{renderTeamContent(prevTeam)}</div>
                      {/* Current team - bottom half */}
                      <div style={{ height: "50%" }}>{renderTeamContent(team)}</div>
                    </div>
                  ) : (
                    /* No animation - just show current team */
                    <div style={{ height: "100%" }}>{renderTeamContent(team)}</div>
                  )}
                </div>

                {/* Bottom section: Stat value */}
                <div className="bg-base-100 px-4 py-4 text-center relative z-10">
                  <div className="text-3xl font-bold text-base-content">
                    {[
                      "TS%",
                      "ORB%",
                      "DRB%",
                      "TRB%",
                      "AST%",
                      "USG%",
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
                      "WIN_PCT",
                    ].includes(rankings.category)
                      ? formatPercentageStat(team.value, rankings.label)
                      : formatStatValue(team.value, rankings.label)}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Custom animation styles */}
      <style>{`
        @keyframes cardSlideTransition {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-50%);
          }
        }
        
        .card-slide-transition {
          animation: cardSlideTransition 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
