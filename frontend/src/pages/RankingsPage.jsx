import { useState, useRef } from "react";
import { RankingsGrid } from "../components/RankingsGrid";
import { Top5Showcase } from "../components/Top5Showcase";
import { useCategories, useRankings } from "../hooks/useApi";

const CATEGORY_GROUPS = [
  {
    label: "Basic",
    codes: [
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
  const [selectedCategory, setSelectedCategory] = useState("PPG");
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const season = import.meta.env.VITE_CURRENT_SEASON || "2025";
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: rankings } = useRankings(selectedCategory, season);

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
      {/* Controls Section */}
      <div className="card bg-base-200 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title text-xl">Filters</h2>

          {/* Category Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Stat Category</span>
            <select
              className="select select-bordered w-full max-w-sm"
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
            <div className="mt-1">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSurpriseMe}
                disabled={categoriesLoading}
              >
                🎲 Surprise me
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rankings Display */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">
            {selectedCategoryLabel} Rankings - 2025-26 Season
          </h2>

          {/* Top 5 Showcase - above the rankings table */}
          <Top5Showcase
            rankings={rankings}
            category={selectedCategory}
            shouldAnimate={shouldAnimate}
          />

          {/* Rankings Table */}
          <RankingsGrid category={selectedCategory} season={season} />
        </div>
      </div>
    </>
  );
}
