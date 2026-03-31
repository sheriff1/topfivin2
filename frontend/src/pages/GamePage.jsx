import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAllTeams } from "../hooks/useApi";
import { useGameEngine } from "../hooks/useGameEngine";
import { formatStatValue } from "../utils/statFormatter";

function getTeamColor(teamId, allTeams) {
  const teamData = allTeams?.find((t) => t.team_id === teamId);
  if (!teamData?.team_colors) return "#333333";

  const primaryColor = teamData.team_colors.primary || "#333333";
  const secondaryColor = teamData.team_colors.secondary || "#FFFFFF";

  // Jazz and Rockets always use secondary
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

export function GamePage() {
  const {
    score,
    highScore,
    gameState,
    currentQuestion,
    loading,
    selectedTeamId,
    submitAnswer,
    nextQuestion,
    startGame,
    resetGame,
  } = useGameEngine();

  const { data: allTeams } = useAllTeams();

  // Score animation state
  const [displayScore, setDisplayScore] = useState(score);
  const [scoreAnimating, setScoreAnimating] = useState(false);
  const prevScoreRef = useRef(score);

  useEffect(() => {
    if (score > prevScoreRef.current) {
      setScoreAnimating(true);
      const t1 = setTimeout(() => {
        setDisplayScore(score);
        setScoreAnimating(false);
      }, 150);
      return () => clearTimeout(t1);
    }
    setDisplayScore(score);
    prevScoreRef.current = score;
    return undefined;
  }, [score]);

  // Build logo list for marquee from allTeams
  const logos = allTeams?.map((t) => t.logo_url).filter(Boolean) || [];
  const logosRow1 = logos.slice(0, 15);
  const logosRow2 = logos.slice(15, 30);

  // Intro screen
  if (gameState === "intro") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="max-w-md w-full">
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body items-center text-center">
              <h1
                className="text-3xl sm:text-4xl font-bold mb-4"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                NBA Top Five In Guesser
              </h1>
              <p className="text-base-content/70 mb-6 text-lg">
                Test your NBA knowledge! Guess which team is ranked in the top 5 for each stat
                category. How long can you keep your streak going?
              </p>

              {/* Logo marquee - 2 rows */}
              {logosRow1.length > 0 && (
                <div className="overflow-hidden mb-2 w-full">
                  <div className="flex gap-4 animate-marquee">
                    {[...logosRow1, ...logosRow1].map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0 opacity-80"
                      />
                    ))}
                  </div>
                </div>
              )}
              {logosRow2.length > 0 && (
                <div className="overflow-hidden mb-6 w-full">
                  <div className="flex gap-4 animate-marquee-reverse">
                    {[...logosRow2, ...logosRow2].map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0 opacity-80"
                      />
                    ))}
                  </div>
                </div>
              )}

              <button className="btn btn-primary btn-lg px-12 w-full" onClick={startGame}>
                Play
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading || (!currentQuestion && gameState === "playing")) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Game Over state
  if (gameState === "ended") {
    const isNewHighScore = score >= highScore && score > 0;
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="card bg-base-200 shadow-xl max-w-md w-full">
          <div className="card-body items-center text-center">
            <h2 className="card-title text-3xl mb-2">Game Over!</h2>
            <p
              className="text-5xl font-bold text-amber-500 mb-4"
              style={{ fontFamily: "'Press Start 2P', cursive" }}
            >
              {score}
            </p>
            {isNewHighScore ? (
              <p className="text-lg font-bold text-warning mb-4">New High Score!</p>
            ) : (
              <p className="text-base-content/50 mb-4">Your High Score: {highScore}</p>
            )}
            <div className="flex flex-col gap-2 w-full">
              <button className="btn btn-primary" onClick={resetGame}>
                Play Again
              </button>
              <Link to="/" className="btn btn-outline">
                View all Rankings
              </Link>
              <Link to="/teams" className="btn btn-outline">
                View by Teams
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  // Playing / Correct / Wrong states
  const isRevealed = gameState === "correct" || gameState === "wrong";

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full">
        {/* Score display */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mb-4">
          <div
            className="badge badge-lg text-sm px-4 py-3 bg-blue-600 text-white border-blue-600"
            style={{ fontFamily: "'Press Start 2P', cursive" }}
          >
            Your High Score: {highScore}
          </div>
          <div
            className="badge badge-lg text-sm px-4 py-3 bg-yellow-300 text-black border-yellow-300 overflow-hidden"
            style={{ fontFamily: "'Press Start 2P', cursive" }}
          >
            <span className="mr-1">Score:</span>
            <span
              className={`inline-block transition-all duration-200 ${
                scoreAnimating ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
              }`}
            >
              {displayScore}
            </span>
          </div>
        </div>

        {/* Question card */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="text-xl text-center mb-6 font-bold">
              Which team is ranked <span className="text-amber-500">{currentQuestion.ordinal}</span>{" "}
              in {currentQuestion.label}?
            </h2>

            {/* Choices */}
            <div className="flex flex-col gap-3">
              {currentQuestion.choices.map((team) => {
                const isCorrect = team.isCorrect;
                const isSelected = team.team_id === selectedTeamId;
                const teamColor = getTeamColor(team.team_id, allTeams);

                let btnClass = "";
                let btnStyle = { backgroundColor: teamColor, color: "white" };

                if (isRevealed) {
                  if (isCorrect) {
                    btnClass = "ring-2 ring-success";
                  } else if (isSelected) {
                    btnClass = "ring-2 ring-error opacity-75";
                  } else {
                    btnStyle = { ...btnStyle, opacity: 0.5 };
                  }
                }

                return (
                  <button
                    key={team.team_id}
                    className={`btn btn-lg w-full justify-start gap-3 pl-0 overflow-hidden ${btnClass}`}
                    style={btnStyle}
                    onClick={() => submitAnswer(team.team_id)}
                    disabled={isRevealed}
                  >
                    <div
                      className="w-12 self-stretch flex-shrink-0"
                      style={{
                        backgroundColor: teamColor,
                        backgroundImage: team.logo_url ? `url(${team.logo_url})` : undefined,
                        backgroundSize: "175%",
                        backgroundPosition: "center",
                      }}
                    />
                    <span className="flex-1 text-left truncate">{team.team_name}</span>
                    {isRevealed && (
                      <span className="badge badge-ghost !text-base-content whitespace-nowrap flex-shrink-0">
                        #{team.rank} ({formatStatValue(team.value, currentQuestion.label)})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feedback message */}
            {gameState === "correct" && (
              <div className="flex flex-col items-center gap-3 mt-4">
                <div className="text-success font-bold text-lg">Correct!</div>
                <button className="btn btn-success w-full" onClick={nextQuestion}>
                  Next
                </button>
              </div>
            )}
            {gameState === "wrong" && (
              <div className="text-center mt-4 text-error font-bold text-lg">
                Wrong, the answer was the{" "}
                {currentQuestion.choices.find((c) => c.isCorrect)?.team_name}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
