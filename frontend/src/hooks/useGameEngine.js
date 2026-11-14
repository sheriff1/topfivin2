/* global localStorage */
import { useState, useCallback, useRef, useEffect } from "react";
import {
  getDifficulty,
  pickCategory,
  buildQuestion,
  isLowerBetter,
  RECENT_CATEGORY_MEMORY,
} from "../utils/gameDifficulty";
import { useCategories, useCurrentSeason, apiClient } from "./useApi";

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

export function useGameEngine() {
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: currentSeason } = useCurrentSeason();

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
  // Most recent categories asked this game, so questions don't repeat a stat
  const recentCategoriesRef = useRef([]);
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
      const failedCodes = [];

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // After several failed attempts, fall back to an easier question rather than failing.
        const difficulty =
          attempt < 5 ? getDifficulty(qNumber) : Math.min(getDifficulty(qNumber), 0.1);

        const category = pickCategory(categories, difficulty, Math.random, [
          ...recentCategoriesRef.current,
          ...failedCodes,
        ]);
        if (!category) break;

        try {
          const response = await apiClient.get("/rankings", {
            params: { category: category.code, season: currentSeason },
          });

          const built = buildQuestion({
            rankings: response.data?.rankings,
            mode: activeMode,
            difficulty,
          });
          if (!built) {
            failedCodes.push(category.code);
            continue;
          }

          const { correct: correctTeam, targetRank, choices } = built;

          recentCategoriesRef.current = [...recentCategoriesRef.current, category.code].slice(
            -RECENT_CATEGORY_MEMORY
          );
          if (mountedRef.current) {
            setCurrentQuestion({
              category: category.code,
              label: response.data.label || category.label,
              rank: targetRank,
              ordinal: ORDINAL[targetRank] || `#${targetRank}`,
              correctTeamId: correctTeam.team_id,
              choices,
              mode: activeMode,
              lowerIsBetter: isLowerBetter(category.code),
            });
            setLoading(false);
          }
          return;
        } catch {
          // API error, try another category
          failedCodes.push(category.code);
          continue;
        }
      }

      // If all attempts failed, still stop loading
      if (mountedRef.current) {
        setLoading(false);
      }
    },
    [categories, currentSeason]
  );

  // Generate initial question when categories load
  useEffect(() => {
    if (
      categories &&
      categories.length > 0 &&
      currentSeason &&
      gameState === "playing" &&
      !currentQuestion
    ) {
      generateQuestion(0, activeModeRef.current);
    }
  }, [categories, currentSeason, gameState, currentQuestion, generateQuestion]);

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
      recentCategoriesRef.current = [];
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
    recentCategoriesRef.current = [];
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
