import { describe, it, expect } from "vitest";
import {
  MAX_DIFFICULTY,
  MAX_DIFFICULTY_QUESTION,
  EXCLUDED_CODES,
  TIER_1,
  getDifficulty,
  getChoiceCount,
  getMaxChallengeRank,
  getTier,
  getTierWeights,
  isLowerBetter,
  pickCategory,
  RECENT_CATEGORY_MEMORY,
  pickDistractors,
  buildQuestion,
} from "../gameDifficulty";

/** Deterministic rng: cycles through a fixed list of values. */
function seeded(values = [0.1, 0.5, 0.9, 0.3, 0.7]) {
  let i = 0;
  return () => values[i++ % values.length];
}

/** 30 teams ranked 1..30 with values 30..1 (evenly spaced). */
function makeRankings(n = 30) {
  return Array.from({ length: n }, (_, i) => ({
    team_id: i + 1,
    team_name: `Team ${i + 1}`,
    logo_url: null,
    rank: i + 1,
    value: n - i,
  }));
}

const CATEGORIES = [
  ...TIER_1.map((code) => ({ code, label: code })),
  { code: "TS%", label: "TS%" }, // tier 2
  { code: "BIG_RUN", label: "Big Run" }, // tier 3
  { code: "ATTEND", label: "Attendance" }, // excluded
  { code: "TPG", label: "Turnovers" }, // tier 2, lower is better
];

describe("getDifficulty", () => {
  it("starts at 0 and rises with the question number", () => {
    expect(getDifficulty(0)).toBe(0);
    expect(getDifficulty(3)).toBeGreaterThan(getDifficulty(2));
    expect(getDifficulty(8)).toBeGreaterThan(getDifficulty(4));
  });

  it("reaches max difficulty on question 12 (0-based 11)", () => {
    expect(getDifficulty(MAX_DIFFICULTY_QUESTION - 2)).toBeLessThan(MAX_DIFFICULTY);
    expect(getDifficulty(MAX_DIFFICULTY_QUESTION - 1)).toBe(MAX_DIFFICULTY);
  });

  it("never exceeds the cap", () => {
    expect(getDifficulty(12)).toBe(MAX_DIFFICULTY);
    expect(getDifficulty(500)).toBe(MAX_DIFFICULTY);
  });
});

describe("getChoiceCount", () => {
  it("is 3 early and 4 late, and never decreases", () => {
    expect(getChoiceCount(getDifficulty(0))).toBe(3);
    expect(getChoiceCount(getDifficulty(MAX_DIFFICULTY_QUESTION))).toBe(4);
    let prev = 0;
    for (let q = 0; q < 30; q++) {
      const n = getChoiceCount(getDifficulty(q));
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });
});

describe("getMaxChallengeRank", () => {
  it("goes from 3 to 5", () => {
    expect(getMaxChallengeRank(0)).toBe(3);
    expect(getMaxChallengeRank(1)).toBe(5);
  });
});

describe("category tiers", () => {
  it("defaults unknown categories to tier 3", () => {
    expect(getTier("PPG")).toBe(1);
    expect(getTier("TS%")).toBe(2);
    expect(getTier("SOMETHING_NEW")).toBe(3);
  });

  it("keeps lower-is-better stats out of tier 1", () => {
    expect(TIER_1.some((c) => isLowerBetter(c))).toBe(false);
  });

  it("opens tier 2 after question 3 and tier 3 at question 7", () => {
    for (let q = 0; q < 3; q++) {
      const w = getTierWeights(getDifficulty(q));
      expect(w[2]).toBe(0);
      expect(w[3]).toBe(0);
    }
    expect(getTierWeights(getDifficulty(5))[2]).toBeGreaterThan(0);
    expect(getTierWeights(getDifficulty(5))[3]).toBe(0);
    expect(getTierWeights(getDifficulty(8))[3]).toBeGreaterThan(0);
  });
});

describe("pickCategory", () => {
  it("only returns tier 1 categories for the first three questions", () => {
    for (let q = 0; q < 3; q++) {
      for (let n = 0; n < 200; n++) {
        const c = pickCategory(CATEGORIES, getDifficulty(q), Math.random);
        expect(TIER_1).toContain(c.code);
      }
    }
  });

  it("never returns excluded categories", () => {
    const seen = new Set();
    for (let n = 0; n < 500; n++) {
      seen.add(pickCategory(CATEGORIES, MAX_DIFFICULTY, Math.random).code);
    }
    for (const code of EXCLUDED_CODES) expect(seen.has(code)).toBe(false);
  });

  it("can return tier 3 categories at max difficulty", () => {
    const seen = new Set();
    for (let n = 0; n < 500; n++) {
      seen.add(pickCategory(CATEGORIES, MAX_DIFFICULTY, Math.random).code);
    }
    expect(seen.has("BIG_RUN")).toBe(true);
  });

  it("falls back to an available tier if tier 1 is empty", () => {
    const only3 = [{ code: "BIG_RUN", label: "Big Run" }];
    expect(pickCategory(only3, 0, seeded()).code).toBe("BIG_RUN");
  });

  it("returns null when nothing is eligible", () => {
    expect(pickCategory([{ code: "ATTEND", label: "x" }], 0, seeded())).toBeNull();
  });
});

describe("pickCategory avoid list", () => {
  it("never returns an avoided category", () => {
    const avoid = ["PPG", "RPG", "APG"];
    for (let n = 0; n < 300; n++) {
      expect(avoid).not.toContain(pickCategory(CATEGORIES, 0, Math.random, avoid).code);
    }
  });

  it("ignores the avoid list when it would leave nothing to pick", () => {
    const only = [{ code: "PPG", label: "PPG" }];
    expect(pickCategory(only, 0, seeded(), ["PPG"]).code).toBe("PPG");
  });

  it("remembers a few recent categories", () => {
    expect(RECENT_CATEGORY_MEMORY).toBeGreaterThanOrEqual(1);
  });
});

describe("pickDistractors", () => {
  const rankings = makeRankings();
  const correct = rankings[2]; // rank 3
  const args = { rankings, correct, mode: "classic", count: 3 };

  it("picks distant teams at low difficulty and close teams at high difficulty", () => {
    const avgGap = (difficulty) => {
      let total = 0;
      let n = 0;
      for (let i = 0; i < 100; i++) {
        const picks = pickDistractors({ ...args, difficulty, rng: Math.random });
        picks.forEach((p) => {
          total += Math.abs(p.value - correct.value);
          n++;
        });
      }
      return total / n;
    };
    expect(avgGap(1)).toBeLessThan(avgGap(0));
  });

  it("never returns the correct team or a top-5 team in classic mode", () => {
    for (const difficulty of [0, 0.5, 1]) {
      const picks = pickDistractors({ ...args, difficulty, rng: Math.random });
      expect(picks).toHaveLength(3);
      picks.forEach((p) => {
        expect(p.team_id).not.toBe(correct.team_id);
        expect(p.rank).toBeGreaterThan(5);
      });
    }
  });

  it("allows adjacent ranks only at max difficulty", () => {
    const minRank = (difficulty) =>
      Math.min(
        ...Array.from({ length: 200 }, () =>
          Math.min(...pickDistractors({ ...args, difficulty, rng: Math.random }).map((p) => p.rank))
        )
      );
    expect(minRank(1)).toBe(6);
    expect(minRank(0)).toBeGreaterThanOrEqual(8);
  });

  it("at the easiest difficulty reaches the late teens but never the closest teams", () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      pickDistractors({ ...args, count: 2, difficulty: 0, rng: Math.random }).forEach((p) =>
        seen.add(p.rank)
      );
    }
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(15);
    expect(Math.min(...seen)).toBeLessThanOrEqual(18);
    expect(Math.max(...seen)).toBe(30);
  });

  it("only picks lower-ranked teams in challenge mode", () => {
    const picks = pickDistractors({ ...args, mode: "challenge", difficulty: 1, rng: Math.random });
    picks.forEach((p) => expect(p.rank).toBeGreaterThan(correct.rank));
  });

  it("returns [] when there are too few eligible teams", () => {
    expect(pickDistractors({ ...args, rankings: makeRankings(8), difficulty: 0 })).toEqual([]);
  });
});

describe("buildQuestion", () => {
  it("builds a 3-choice question at low difficulty with exactly one correct answer", () => {
    const q = buildQuestion({
      rankings: makeRankings(),
      mode: "classic",
      difficulty: 0,
      rng: seeded(),
    });
    expect(q.choices).toHaveLength(3);
    expect(q.choices.filter((c) => c.isCorrect)).toHaveLength(1);
    expect(q.correct.rank).toBeLessThanOrEqual(5);
  });

  it("builds a 4-choice question at max difficulty", () => {
    const q = buildQuestion({
      rankings: makeRankings(),
      mode: "classic",
      difficulty: 1,
      rng: seeded(),
    });
    expect(q.choices).toHaveLength(4);
    expect(new Set(q.choices.map((c) => c.team_id)).size).toBe(4);
  });

  it("falls back to 3 choices when there are too few distractors for 4", () => {
    // 8 teams, top-5 target: only ranks 6-8 (3 teams) are eligible at max difficulty -> 4 ok;
    // 7 teams leaves 2 -> must fall back to 3 choices.
    const q = buildQuestion({
      rankings: makeRankings(7),
      mode: "classic",
      difficulty: 1,
      rng: seeded(),
    });
    expect(q.choices).toHaveLength(3);
  });

  it("returns null when the target rank is tied", () => {
    const rankings = makeRankings();
    rankings[1].rank = 1; // two teams at rank 1
    // rng 0 -> challenge target rank 1
    expect(buildQuestion({ rankings, mode: "challenge", difficulty: 0, rng: () => 0 })).toBeNull();
  });

  it("returns null for empty rankings", () => {
    expect(buildQuestion({ rankings: [], mode: "classic", difficulty: 0 })).toBeNull();
    expect(buildQuestion({ rankings: undefined, mode: "classic", difficulty: 0 })).toBeNull();
  });

  it("limits challenge ranks to 1-3 early and allows up to 5 late", () => {
    const rankOf = (difficulty) => {
      const ranks = new Set();
      for (let i = 0; i < 300; i++) {
        const q = buildQuestion({
          rankings: makeRankings(),
          mode: "challenge",
          difficulty,
          rng: Math.random,
        });
        ranks.add(q.targetRank);
      }
      return Math.max(...ranks);
    };
    expect(rankOf(0)).toBe(3);
    expect(rankOf(1)).toBe(5);
  });
});
