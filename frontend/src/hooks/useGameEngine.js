/* global localStorage */
import { useState, useCallback, useRef, useEffect } from "react";
import { useCategories, apiClient, CURRENT_SEASON } from "./useApi";

const BASIC_CODES = [
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
];

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th"];

const HIGH_SCORE_KEYS = {
  classic: "topfivin-game-highscore-classic",
  challenge: "topfivin-game-highscore-challenge",
};

function getHighScore(mode) {
  try {
    return parseInt(localStorage.getItem(HIGH_SCORE_KEYS[mode]), 10) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore(mode, score) {
  try {
    localStorage.setItem(HIGH_SCORE_KEYS[mode], String(score));
  } catch {
    // localStorage unavailable
  }
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function useGameEngine() {
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const [gameMode, setGameMode] = useState("classic"); // classic | challenge
  const [gameState, setGameState] = useState("intro"); // intro | playing | correct | wrong | ended
  const [questionNumber, setQuestionNumber] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => getHighScore("classic"));
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const activeModeRef = useRef("classic");
  const autoAdvanceTimer = useRef(null);
  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);

  // Update high score when mode changes on intro screen
  const handleSetGameMode = useCallback((mode) => {
    setGameMode(mode);
    setHighScore(getHighScore(mode));
    activeModeRef.current = mode;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  const generateQuestion = useCallback(
    async (qNumber, mode) => {
      if (!categories || categories.length === 0) return;

      const activeMode = mode || activeModeRef.current;
      setLoading(true);
      const maxAttempts = 10;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Pick category based on difficulty ramp
        let pool;
        if (qNumber < 3) {
          pool = categories.filter((c) => BASIC_CODES.includes(c.code));
        } else {
          pool = categories;
        }

        if (pool.length === 0) pool = categories;

        const category = pickRandom(pool);

        try {
          const response = await apiClient.get("/rankings", {
            params: { category: category.code, season: CURRENT_SEASON },
          });

          const rankings = response.data?.rankings;
          if (!rankings || rankings.length === 0) continue;

          let correctTeam;
          let targetRank;
          let wrongPool;

          if (activeMode === "classic") {
            // Classic: pick a random team from top 5
            const top5 = rankings.filter((r) => r.rank >= 1 && r.rank <= 5);
            if (top5.length === 0) continue;

            correctTeam = pickRandom(top5);
            targetRank = correctTeam.rank;

            // Check for ties
            const teamsAtRank = rankings.filter((r) => r.rank === targetRank);
            if (teamsAtRank.length > 1) continue;

            // Wrong choices: outside top 5, with >2 rank buffer from boundary
            wrongPool = rankings.filter((r) => r.rank > 7);
          } else {
            // Challenge: guess specific rank (existing logic)
            const maxRank = qNumber < 3 ? 3 : 5;
            targetRank = Math.floor(Math.random() * maxRank) + 1;

            correctTeam = rankings.find((r) => r.rank === targetRank);
            if (!correctTeam) continue;

            // Check for ties
            const teamsAtRank = rankings.filter((r) => r.rank === targetRank);
            if (teamsAtRank.length > 1) continue;

            // Wrong choices: ranked lower, >2 away from target
            wrongPool = rankings.filter(
              (r) => r.rank > targetRank && Math.abs(r.rank - targetRank) > 2
            );
          }

          if (wrongPool.length < 2) continue;

          const shuffledWrong = shuffleArray(wrongPool);
          const wrongChoices = shuffledWrong.slice(0, 2);

          const choices = shuffleArray([
            {
              team_id: correctTeam.team_id,
              team_name: correctTeam.team_name,
              logo_url: correctTeam.logo_url,
              rank: correctTeam.rank,
              value: correctTeam.value,
              isCorrect: true,
            },
            ...wrongChoices.map((t) => ({
              team_id: t.team_id,
              team_name: t.team_name,
              logo_url: t.logo_url,
              rank: t.rank,
              value: t.value,
              isCorrect: false,
            })),
          ]);

          if (mountedRef.current) {
            setCurrentQuestion({
              category: category.code,
              label: response.data.label || category.label,
              rank: targetRank,
              ordinal: ORDINAL[targetRank] || `#${targetRank}`,
              correctTeamId: correctTeam.team_id,
              choices,
              mode: activeMode,
            });
            setLoading(false);
          }
          return;
        } catch {
          // API error, try another category
          continue;
        }
      }

      // If all attempts failed, still stop loading
      if (mountedRef.current) {
        setLoading(false);
      }
    },
    [categories]
  );

  // Generate initial question when categories load
  useEffect(() => {
    if (categories && categories.length > 0 && gameState === "playing" && !currentQuestion) {
      generateQuestion(0, activeModeRef.current);
    }
  }, [categories, gameState, currentQuestion, generateQuestion]);

  const submitAnswer = useCallback(
    (teamId) => {
      if (gameState !== "playing" || !currentQuestion) return;

      setSelectedTeamId(teamId);

      if (teamId === currentQuestion.correctTeamId) {
        const newScore = score + 1;
        setScore(newScore);
        setGameState("correct");

        if (newScore > highScore) {
          setHighScore(newScore);
          saveHighScore(activeModeRef.current, newScore);
        }
      } else {
        setGameState("wrong");
        autoAdvanceTimer.current = setTimeout(() => {
          if (mountedRef.current) {
            setGameState("ended");
          }
        }, 2500);
      }
    },
    [gameState, currentQuestion, score, highScore, questionNumber, generateQuestion]
  );

  const startGame = useCallback(
    (mode) => {
      const selected = mode || gameMode;
      setGameMode(selected);
      activeModeRef.current = selected;
      setHighScore(getHighScore(selected));
      setScore(0);
      setQuestionNumber(0);
      setGameState("playing");
      setCurrentQuestion(null);
      setSelectedTeamId(null);
    },
    [gameMode]
  );

  const resetGame = useCallback(() => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    setScore(0);
    setQuestionNumber(0);
    setGameState("playing");
    setCurrentQuestion(null);
    setSelectedTeamId(null);
  }, []);

  const nextQuestion = useCallback(() => {
    if (gameState !== "correct") return;
    const nextQ = questionNumber + 1;
    setQuestionNumber(nextQ);
    setGameState("playing");
    setSelectedTeamId(null);
    generateQuestion(nextQ, activeModeRef.current);
  }, [gameState, questionNumber, generateQuestion]);

  return {
    gameState,
    gameMode,
    setGameMode: handleSetGameMode,
    questionNumber,
    score,
    highScore,
    currentQuestion,
    loading: loading || categoriesLoading,
    selectedTeamId,
    submitAnswer,
    nextQuestion,
    startGame,
    resetGame,
  };
}
