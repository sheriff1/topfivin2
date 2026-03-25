/* global requestAnimationFrame, cancelAnimationFrame */
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useRandomFacts, useAllTeams, CURRENT_SEASON } from "../hooks/useApi";

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

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th"];

function getCardColor(teamId, allTeams) {
  const teamData = allTeams?.find((t) => t.team_id === teamId);
  if (!teamData?.team_colors) return "#000000";

  const primaryColor = teamData.team_colors.primary || "#000000";
  const secondaryColor = teamData.team_colors.secondary || "#FFFFFF";

  // Jazz and Rockets always use secondary color
  if (teamId === 1610612762 || teamId === 1610612745) {
    return secondaryColor;
  }

  const hex = primaryColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance < 0.5 ? primaryColor : secondaryColor;
}

export function DidYouKnow() {
  const season = CURRENT_SEASON;
  const { data: facts } = useRandomFacts(10, season);
  const { data: allTeams } = useAllTeams();
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(Date.now());
  const SLIDE_DURATION = 5000;

  // Progress animation + auto-advance
  useEffect(() => {
    if (!facts || facts.length === 0) return undefined;
    startTimeRef.current = Date.now();
    setProgress(0);

    let rafId;
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / SLIDE_DURATION, 1);
      setProgress(pct);

      if (pct >= 1) {
        setActiveIndex((prev) => (prev + 1) % facts.length);
        return;
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [facts, activeIndex]);

  if (!facts || facts.length === 0) return null;

  const fact = facts[activeIndex];
  const abbreviation = TEAM_ID_TO_ABBR[fact.team_id];
  const backgroundColor = getCardColor(fact.team_id, allTeams);

  return (
    <div className="overflow-hidden h-full">
      <Link to={`/team/${abbreviation}`} className="block h-full">
        <div
          className="relative flex items-center h-full min-h-40 overflow-hidden transition-colors duration-500"
          style={{ backgroundColor }}
        >
          {/* Zoomed logo background */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: `url(${fact.logo_url})`,
              backgroundSize: "175%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />

          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-black/25" />

          {/* Content */}
          <div className="relative z-10 p-5 pb-8 flex flex-col justify-center w-full">
            <span
              className="text-xs sm:text-sm font-bold tracking-widest text-white/90 mb-1"
              style={{ fontFamily: '"League Gothic", sans-serif', letterSpacing: "0.15em" }}
            >
              DID YOU KNOW...
            </span>
            <p className="text-white text-lg sm:text-xl font-bold leading-snug break-words">
              The {fact.team_name} are ranked{" "}
              <span className="text-yellow-300">{ORDINAL[fact.rank] || `#${fact.rank}`}</span> in{" "}
              {fact.label}
            </p>
          </div>

          {/* Dot indicators with progress */}
          <div className="absolute bottom-2 left-5 z-20 flex gap-1.5 items-center">
            {facts.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveIndex(i);
                }}
                className="relative h-1.5 rounded-full overflow-hidden transition-all duration-300"
                style={{ width: i === activeIndex ? "1.5rem" : "0.375rem" }}
                aria-label={`Go to fact ${i + 1}`}
              >
                {/* Background track */}
                <div className="absolute inset-0 rounded-full bg-white/30" />
                {/* Fill */}
                {i === activeIndex && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white"
                    style={{ width: `${progress * 100}%` }}
                  />
                )}
                {i !== activeIndex && <div className="absolute inset-0 rounded-full bg-white/30" />}
              </button>
            ))}
          </div>
        </div>
      </Link>
    </div>
  );
}
