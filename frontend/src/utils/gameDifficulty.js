/**
 * Game difficulty ramp (#287).
 *
 * Pure selection logic for the game: how hard question N is, which category it
 * draws from, and which teams are offered as answers. Every function that needs
 * randomness takes an injectable `rng` (a () => number in [0, 1)) so it can be
 * tested deterministically.
 *
 * Difficulty is a number from 0 (easiest) to 1 (hardest). It rises linearly with
 * the question number and is capped: question MAX_DIFFICULTY_QUESTION and every
 * question after it is played at MAX_DIFFICULTY.
 */

/** 1-based question number at which full difficulty is reached. */
export const MAX_DIFFICULTY_QUESTION = 12;
export const MAX_DIFFICULTY = 1;

/** Difficulty at which the 4th answer choice is introduced (question 7). */
export const FOUR_CHOICE_DIFFICULTY = 0.5;

/**
 * Distractor window at the easiest difficulty: the share of eligible teams (ordered
 * by value gap, farthest first) that can be offered. With ~23 eligible teams,
 * 0.6 spans roughly ranks 17-30. It shrinks to the nearest few teams as
 * difficulty rises.
 */
export const EASY_WINDOW_FRACTION = 0.6;

/**
 * Category tiers. T1 = stats most fans know, T2 = common advanced / shooting /
 * team stats, T3 = everything else (default for any code not listed here, so
 * newly added backend categories land in the hardest tier automatically).
 */
export const TIER_1 = [
  "W",
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
];

export const TIER_2 = [
  "L",
  "TPG",
  "PFPG",
  "TS%",
  "EFG%",
  "ORTG",
  "DRTG",
  "NET_RTG",
  "PACE",
  "ORPG",
  "DRPG",
  "PIE",
  "PM",
  "AST_TOV",
  "PTS_PAINT",
  "FAST_BRK",
  "OPP_PAINT",
  "OPP_FBRK",
  "DEFLECT",
  "BOX_OUTS",
  "CHARGES",
  "FOULS_DRAWN",
  "TOV%",
  "AST%",
  "ORB%",
  "DRB%",
  "TRB%",
  "STARTERS_PPG",
  "BENCH_PPG",
  "BENCH_PTS",
  "Q1_PTS",
  "Q2_PTS",
  "Q3_PTS",
  "Q4_PTS",
];

/** Not meaningfully guessable from basketball knowledge: never asked. */
export const EXCLUDED_CODES = ["ATTEND", "DURATION"];

/**
 * Categories where the lowest value ranks 1st. The categories endpoint does not
 * expose this, so it is mirrored from the backend. They are kept out of tier 1
 * and the question shows a "lowest is best" hint.
 */
export const LOWER_IS_BETTER = [
  "L",
  "TOV%",
  "DRTG",
  "OPP_PAINT",
  "OPP_FBRK",
  "OPP_PTS_OFF_TO",
  "OPP_2ND_CHC",
  "BLK_AGT",
  "TPG",
  "PFPG",
  "TOV_RATIO",
  "TOV_TEAM",
  "TOV_TOTAL",
  "STARTERS_TOV",
  "STARTERS_PF",
  "BENCH_TOV",
  "BENCH_PF",
  "E_DRTG",
];

const TIER_1_SET = new Set(TIER_1);
const TIER_2_SET = new Set(TIER_2);
const EXCLUDED_SET = new Set(EXCLUDED_CODES);
const LOWER_SET = new Set(LOWER_IS_BETTER);

export function isLowerBetter(code) {
  return LOWER_SET.has(code);
}

export function getTier(code) {
  if (TIER_1_SET.has(code)) return 1;
  if (TIER_2_SET.has(code)) return 2;
  return 3;
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

/**
 * Difficulty for a question.
 * @param {number} questionNumber 0-based (the game's first question is 0)
 * @returns {number} 0..MAX_DIFFICULTY
 */
export function getDifficulty(questionNumber) {
  const steps = MAX_DIFFICULTY_QUESTION - 1;
  return clamp01(questionNumber / steps) * MAX_DIFFICULTY;
}

/** 3 choices early, 4 once difficulty reaches FOUR_CHOICE_DIFFICULTY. */
export function getChoiceCount(difficulty) {
  return difficulty >= FOUR_CHOICE_DIFFICULTY ? 4 : 3;
}

/** Largest target rank asked in challenge mode: 3 early, up to 5 at max. */
export function getMaxChallengeRank(difficulty) {
  return Math.min(5, 3 + Math.floor(difficulty * 2.5));
}

/**
 * Relative likelihood of drawing from each tier at a difficulty. Tier 2 opens at
 * 0.2 (question 4) and tier 3 at 0.5 (question 7); tier 1 never goes away.
 */
export function getTierWeights(difficulty) {
  const ramp = (from, to) => clamp01((difficulty - from) / (to - from));
  return {
    1: 1,
    2: ramp(0.2, 0.6),
    3: 0.6 * ramp(0.5, 1),
  };
}

/** Number of most recent categories skipped so questions don't repeat a stat. */
export const RECENT_CATEGORY_MEMORY = 3;

/** Category pool for each tier, with excluded and recently used codes removed. */
function groupByTier(categories, avoid) {
  const groups = { 1: [], 2: [], 3: [] };
  for (const c of categories) {
    if (EXCLUDED_SET.has(c.code) || avoid.has(c.code)) continue;
    // Lower-is-better stats are never tier 1 (confusing as a first question).
    const tier = Math.max(getTier(c.code), isLowerBetter(c.code) ? 2 : 1);
    groups[tier].push(c);
  }
  return groups;
}

function pickRandom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle(arr, rng) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Pick a category: choose a tier by weight, then a category uniformly in it.
 * Falls back to an easier tier if the chosen one is empty.
 * Categories in `avoid` (recently asked, or already failed this question) are
 * skipped; if that would leave nothing to pick, the avoid list is ignored.
 * @param {{code: string, label: string}[]} categories
 * @param {number} difficulty
 * @param {() => number} rng
 * @param {string[]} avoid category codes to skip
 */
export function pickCategory(categories, difficulty, rng = Math.random, avoid = []) {
  let groups = groupByTier(categories, new Set(avoid));
  if (!groups[1].length && !groups[2].length && !groups[3].length) {
    groups = groupByTier(categories, new Set());
  }
  const weights = getTierWeights(difficulty);

  const tiers = [1, 2, 3].filter((t) => groups[t].length > 0 && weights[t] > 0);
  if (tiers.length === 0) {
    // Nothing eligible at this difficulty: use whatever exists, easiest first.
    const any = [1, 2, 3].find((t) => groups[t].length > 0);
    return any ? pickRandom(groups[any], rng) : null;
  }

  const total = tiers.reduce((sum, t) => sum + weights[t], 0);
  let roll = rng() * total;
  for (const t of tiers) {
    roll -= weights[t];
    if (roll < 0) return pickRandom(groups[t], rng);
  }
  return pickRandom(groups[tiers[tiers.length - 1]], rng);
}

/**
 * Choose distractors for a target team. Eligible teams are filtered by rank
 * (with a buffer that shrinks as difficulty rises), then ordered by how close
 * their value is to the correct team's, as a share of the category's value
 * spread. Low difficulty draws from the farthest teams, high from the nearest.
 *
 * @returns {object[]} up to `count` rankings rows (fewer if not enough eligible)
 */
export function pickDistractors({ rankings, correct, mode, difficulty, count, rng = Math.random }) {
  // Rank buffer: 2 at difficulty 0, shrinking to 0 (adjacent ranks) at 1.
  const buffer = Math.round(2 * (1 - difficulty));

  const eligible = rankings.filter((r) => {
    if (r.team_id === correct.team_id) return false;
    return mode === "classic" ? r.rank > 5 + buffer : r.rank > correct.rank + buffer;
  });
  if (eligible.length < count) return [];

  const values = rankings.map((r) => Number(r.value));
  const spread = Math.max(...values) - Math.min(...values) || 1;
  const gap = (r) => Math.abs(Number(r.value) - Number(correct.value)) / spread;

  // Nearest first.
  const byCloseness = [...eligible].sort((a, b) => gap(a) - gap(b));

  // Window width: EASY_WINDOW_FRACTION of the eligible teams at difficulty 0,
  // shrinking to the original count * 3 nearest teams at difficulty 1.
  const wideWindow = Math.ceil(EASY_WINDOW_FRACTION * (1 - difficulty) * byCloseness.length);
  const windowSize = Math.min(byCloseness.length, Math.max(count * 3, wideWindow));
  const maxOffset = byCloseness.length - windowSize;
  const offset = Math.round((1 - difficulty) * maxOffset);
  const window = byCloseness.slice(offset, offset + windowSize);

  return shuffle(window, rng).slice(0, count);
}

/**
 * Build one question from a category's rankings, or null if this category can't
 * produce a valid one (no teams, ties at the target rank, too few distractors).
 * The caller should try another category on null.
 *
 * @returns {{correct: object, targetRank: number, choices: object[]} | null}
 */
export function buildQuestion({ rankings, mode, difficulty, rng = Math.random }) {
  if (!rankings || rankings.length === 0) return null;

  let correct;
  if (mode === "classic") {
    const top5 = rankings.filter((r) => r.rank >= 1 && r.rank <= 5);
    if (top5.length === 0) return null;
    correct = pickRandom(top5, rng);
  } else {
    const targetRank = Math.floor(rng() * getMaxChallengeRank(difficulty)) + 1;
    correct = rankings.find((r) => r.rank === targetRank);
    if (!correct) return null;
  }

  // Ties make the answer ambiguous.
  if (rankings.filter((r) => r.rank === correct.rank).length > 1) return null;

  // Prefer 4 choices at high difficulty, but fall back to 3 if too few distractors.
  const wantedChoices = getChoiceCount(difficulty);
  let distractors = pickDistractors({
    rankings,
    correct,
    mode,
    difficulty,
    count: wantedChoices - 1,
    rng,
  });
  if (distractors.length === 0 && wantedChoices > 3) {
    distractors = pickDistractors({ rankings, correct, mode, difficulty, count: 2, rng });
  }
  if (distractors.length === 0) return null;

  const toChoice = (t, isCorrect) => ({
    team_id: t.team_id,
    team_name: t.team_name,
    logo_url: t.logo_url,
    rank: t.rank,
    value: t.value,
    isCorrect,
  });

  return {
    correct,
    targetRank: correct.rank,
    choices: shuffle([toChoice(correct, true), ...distractors.map((t) => toChoice(t, false))], rng),
  };
}
