import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { DidYouKnow } from "../components/DidYouKnow";
import { RankingsGrid } from "../components/RankingsGrid";
import { Top5Showcase } from "../components/Top5Showcase";
import { useCategories, useRankings, CURRENT_SEASON } from "../hooks/useApi";

const CATEGORY_GROUPS = [
  {
    label: "Basic",
    codes: [
      "W",
      "L",
      "WIN_PCT",
      "PPG",
      "FG_PG",
      "FGA_PG",
      "FG%",
      "THREE_PG",
      "3P%",
      "FT%",
      "RPG",
      "APG",
      "SPG",
      "BPG",
      "TPG",
      "PFPG",
    ],
  },
  {
    label: "Offensive",
    codes: [
      "PTS_2ND_CHC",
      "AST%",
      "AST_RATIO",
      "AST_TOV",
      "PCT_AST_2PM",
      "PCT_AST_3PM",
      "PCT_AST_FGM",
      "BIG_LEAD",
      "BIG_RUN",
      "EFG%",
      "E_ORTG",
      "FAST_BRK",
      "PCT_FGA_2PT",
      "PCT_FGA_3PT",
      "FOULS_DRAWN",
      "FT_AST",
      "LEAD_CHG",
      "NET_RTG",
      "LOOSE_BALLS_O",
      "BOX_OUTS_O",
      "ORTG",
      "ORB%",
      "REB_CHANCES_OFF",
      "ORPG",
      "PACE",
      "PACE40",
      "PASSES",
      "PIE",
      "PM",
      "PCT_PTS_2PT",
      "PCT_PTS_2PT_MR",
      "PCT_PTS_3PT",
      "PCT_PTS_FB",
      "PCT_PTS_FT",
      "PCT_PTS_PAINT",
      "PCT_PTS_OFF_TOV",
      "PTS_PAINT",
      "PTS_OFF_TO",
      "POSS",
      "Q1_PTS",
      "Q2_PTS",
      "Q3_PTS",
      "Q4_PTS",
      "SCR_AST_PTS",
      "SCR_AST",
      "SECONDARY_AST",
      "TOV_TOTAL",
      "TOUCHES",
      "TS%",
      "TOV%",
      "TOV_RATIO",
      "PCT_UAST_2PM",
      "PCT_UAST_3PM",
      "PCT_UAST_FGM",
      "USG%",
    ],
  },
  {
    label: "Defensive",
    codes: [
      "BLK_AGT",
      "BOX_OUT_PREB",
      "BOX_OUT_TREB",
      "BOX_OUTS",
      "CHARGES",
      "CONTESTED_2PT",
      "CONTESTED_3PT",
      "CONTESTED_FG%",
      "CONTESTED_FGM",
      "CONTESTED_FGA",
      "CONTESTED",
      "LOOSE_BALLS_D",
      "DAR_FG%",
      "DAR_FGM",
      "DAR_FGA",
      "BOX_OUTS_D",
      "DRTG",
      "DRB%",
      "REB_CHANCES_DEF",
      "DRPG",
      "DEFLECT",
      "E_DRTG",
      "LOOSE_BALLS",
      "OPP_2ND_CHC",
      "OPP_FBRK",
      "OPP_PAINT",
      "OPP_PTS_OFF_TO",
      "TRB%",
      "REB_CHANCES_TOT",
      "UNCONTESTED_FG%",
      "UNCONTESTED_FGM",
      "UNCONTESTED_FGA",
    ],
  },
  {
    label: "Bench",
    codes: [
      "BENCH_3P%",
      "BENCH_3P",
      "BENCH_3PA",
      "BENCH_APG",
      "BENCH_BPG",
      "BENCH_DREB",
      "BENCH_FG",
      "BENCH_FGA",
      "BENCH_FG%",
      "BENCH_PF",
      "BENCH_FT%",
      "BENCH_FT",
      "BENCH_FTA",
      "BENCH_OREB",
      "BENCH_PPG",
      "BENCH_RPG",
      "BENCH_SPG",
      "BENCH_TOV",
    ],
  },
  {
    label: "Starters",
    codes: [
      "STARTERS_3P%",
      "STARTERS_3P",
      "STARTERS_3PA",
      "STARTERS_APG",
      "STARTERS_BPG",
      "STARTERS_DREB",
      "STARTERS_FG",
      "STARTERS_FGA",
      "STARTERS_FG%",
      "STARTERS_PF",
      "STARTERS_FT%",
      "STARTERS_FT",
      "STARTERS_FTA",
      "STARTERS_OREB",
      "STARTERS_PPG",
      "STARTERS_RPG",
      "STARTERS_SPG",
      "STARTERS_TOV",
    ],
  },
  {
    label: "Misc",
    codes: [
      "ATTEND",
      "DURATION",
      "DISTANCE",
      "E_NET_RTG",
      "E_PACE",
      "REB_TEAM",
      "TOV_TEAM",
      "TIMES_TIED",
    ],
  },
];

export function RankingsPage() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const hasInitialized = useRef(false);
  const season = CURRENT_SEASON;
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: rankings } = useRankings(selectedCategory, season);

  // Pick a random category on first load
  useEffect(() => {
    if (categories && categories.length > 0 && !hasInitialized.current) {
      const randomCode = categories[Math.floor(Math.random() * categories.length)].code;
      setSelectedCategory(randomCode);
      hasInitialized.current = true;
    }
  }, [categories]);

  // Build a code→label lookup for optgroup rendering
  const categoryMap = new Map((categories ?? []).map((cat) => [cat.code, cat.label]));

  // Get the label for the selected category
  const selectedCategoryLabel =
    categories?.find((cat) => cat.code === selectedCategory)?.label || selectedCategory;

  // Track last category change time for debounce logic
  const lastCategoryChangeRef = useRef(Date.now());

  // Handle category change with debounce logic
  const handleCategoryChange = (newCategory) => {
    const now = Date.now();
    const timeDelta = now - lastCategoryChangeRef.current;

    // Skip animation if category changed within 200ms (rapid clicks)
    setShouldAnimate(timeDelta >= 200);

    lastCategoryChangeRef.current = now;
    setSelectedCategory(newCategory);
  };

  const handleSurpriseMe = () => {
    const allCodes = categories?.map((cat) => cat.code) ?? [];
    if (allCodes.length === 0) return;
    const randomCode = allCodes[Math.floor(Math.random() * allCodes.length)];
    handleCategoryChange(randomCode);
  };

  return (
    <>
      {/* Mini Hero */}
      <div className="bg-primary text-primary-content">
        <div className="container mx-auto px-4 md:px-6 py-5 flex items-center gap-6">
          <img
            src="https://cdn.nba.com/logos/leagues/logo-nba.svg"
            alt="NBA Logo"
            className="hidden sm:block h-16 w-16 shrink-0"
          />
          <div>
            <h2 className="text-lg sm:text-xl font-bold mb-3">🏀 Welcome to NBA Top Five In</h2>
            <div className="text-sm sm:text-base leading-relaxed space-y-3">
              <p>
                Your team didn&apos;t make it to the finals this year? Didn&apos;t make it to the
                playoffs? Didn&apos;t even get a lottery pick? Have you ever found yourself in
                despair of trying to justify your NBA fandom towards a team? Or found yourself in a
                situation where a friend is trying to convince you that your team is trash? Mourn no
                longer; NBA Top Five In is here. Now you can remind yourself, or tell off your
                friend with a &ldquo;Hey bruh; we were top five in ties per game, so watch your
                mouth!&rdquo; with ease. Just search a team below, and find out what statistical
                categories the team ranks top five in:
              </p>
              <p className="text-xs opacity-75 italic">
                Disclaimer: not every team is fortunate enough to be top five in a statistical
                category... I ain&apos;t make the rules!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + Did You Know */}
      <div className="bg-base-200">
        <div className="lg:container lg:mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1fr]">
          {/* Did You Know - above on mobile, right on desktop */}
          <div className="order-first lg:order-last lg:-mr-[calc((100vw-100%)/2)]">
            <DidYouKnow />
          </div>

          {/* Controls Section */}
          <div className="px-4 md:px-6 py-4 md:py-6">
            <p className="text-sm text-base-content/70 mb-2">
              Choose a stat category to see which teams rank in the top 5.
            </p>

            {/* Category Selector */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Stat Category</span>
              <select
                className="select select-bordered w-full sm:max-w-sm"
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={categoriesLoading}
              >
                {categoriesLoading ? (
                  <option>Loading categories...</option>
                ) : (
                  CATEGORY_GROUPS.map((group) => {
                    const opts = group.codes
                      .filter((code) => categoryMap.has(code))
                      .map((code) => (
                        <option key={code} value={code}>
                          {categoryMap.get(code)}
                        </option>
                      ));
                    return opts.length > 0 ? (
                      <optgroup key={group.label} label={group.label}>
                        {opts}
                      </optgroup>
                    ) : null;
                  })
                )}
              </select>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm w-full sm:w-auto"
                  onClick={handleSurpriseMe}
                  disabled={categoriesLoading}
                >
                  🎲 Surprise me
                </button>
                <Link to="/teams" className="btn btn-primary btn-sm w-full sm:w-auto">
                  View Rankings By Team
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rankings Display */}
      <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
        <h2 className="text-2xl font-bold mb-4">{selectedCategoryLabel} Rankings</h2>

        {/* Top 5 Showcase - above the rankings table */}
        <Top5Showcase
          rankings={rankings}
          category={selectedCategory}
          shouldAnimate={shouldAnimate}
        />

        {/* Rankings Table */}
        <h3 className="text-xl font-bold mt-6 mb-4">Full Team Rankings</h3>
        <RankingsGrid category={selectedCategory} season={season} />
      </div>
    </>
  );
}
