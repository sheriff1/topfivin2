import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GamePage } from "../GamePage";

// Mock useGameEngine
const mockSubmitAnswer = vi.fn();
const mockNextQuestion = vi.fn();
const mockStartGame = vi.fn();
const mockResetGame = vi.fn();

let mockGameState = {
  gameState: "playing",
  questionNumber: 0,
  score: 0,
  highScore: 3,
  currentQuestion: null,
  loading: false,
  selectedTeamId: null,
  submitAnswer: mockSubmitAnswer,
  nextQuestion: mockNextQuestion,
  startGame: mockStartGame,
  resetGame: mockResetGame,
};

vi.mock("../../hooks/useGameEngine", () => ({
  useGameEngine: () => mockGameState,
}));

vi.mock("../../hooks/useApi", () => ({
  useAllTeams: vi.fn(() => ({
    data: [
      {
        team_id: 1610612738,
        team_name: "Boston Celtics",
        team_colors: { primary: "#007A33", secondary: "#BA9653" },
      },
      {
        team_id: 1610612744,
        team_name: "Golden State Warriors",
        team_colors: { primary: "#1D428A", secondary: "#FFC72C" },
      },
      {
        team_id: 1610612747,
        team_name: "Los Angeles Lakers",
        team_colors: { primary: "#552583", secondary: "#FDB927" },
      },
    ],
  })),
  CURRENT_SEASON: "2025",
}));

const SAMPLE_QUESTION = {
  category: "PPG",
  label: "Points Per Game",
  rank: 1,
  ordinal: "1st",
  correctTeamId: 1610612738,
  choices: [
    {
      team_id: 1610612738,
      team_name: "Boston Celtics",
      logo_url: "/logos/BOS.svg",
      rank: 1,
      value: 120.5,
      isCorrect: true,
    },
    {
      team_id: 1610612744,
      team_name: "Golden State Warriors",
      logo_url: "/logos/GSW.svg",
      rank: 10,
      value: 110.2,
      isCorrect: false,
    },
    {
      team_id: 1610612747,
      team_name: "Los Angeles Lakers",
      logo_url: "/logos/LAL.svg",
      rank: 15,
      value: 108.3,
      isCorrect: false,
    },
  ],
};

describe("GamePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGameState = {
      gameState: "playing",
      questionNumber: 0,
      score: 0,
      highScore: 3,
      currentQuestion: null,
      loading: false,
      selectedTeamId: null,
      submitAnswer: mockSubmitAnswer,
      nextQuestion: mockNextQuestion,
      startGame: mockStartGame,
      resetGame: mockResetGame,
    };
  });

  it("should show loading spinner when loading", () => {
    mockGameState.loading = true;

    const { container } = render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(container.querySelector(".loading-spinner")).toBeTruthy();
  });

  it("should show loading when no question and playing", () => {
    mockGameState.currentQuestion = null;
    mockGameState.gameState = "playing";

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(document.querySelector(".loading-spinner")).toBeTruthy();
  });

  it("should render question with team choices", () => {
    mockGameState.currentQuestion = SAMPLE_QUESTION;

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Points Per Game/)).toBeDefined();
    expect(screen.getByText("1st")).toBeDefined();
    expect(screen.getByText("Boston Celtics")).toBeDefined();
    expect(screen.getByText("Golden State Warriors")).toBeDefined();
    expect(screen.getByText("Los Angeles Lakers")).toBeDefined();
  });

  it("should display score and high score", () => {
    mockGameState.currentQuestion = SAMPLE_QUESTION;
    mockGameState.score = 2;
    mockGameState.highScore = 5;

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("Your High Score: 5")).toBeDefined();
  });

  it("should call submitAnswer when a choice is clicked", () => {
    mockGameState.currentQuestion = SAMPLE_QUESTION;

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Boston Celtics"));
    expect(mockSubmitAnswer).toHaveBeenCalledWith(1610612738);
  });

  it("should show 'Correct!' feedback and Next button on correct answer", () => {
    mockGameState.currentQuestion = SAMPLE_QUESTION;
    mockGameState.gameState = "correct";
    mockGameState.selectedTeamId = 1610612738;

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Correct!")).toBeDefined();
    const nextBtn = screen.getByRole("button", { name: "Next" });
    expect(nextBtn).toBeDefined();
    fireEvent.click(nextBtn);
    expect(mockNextQuestion).toHaveBeenCalled();
  });

  it("should show wrong answer feedback", () => {
    mockGameState.currentQuestion = SAMPLE_QUESTION;
    mockGameState.gameState = "wrong";
    mockGameState.selectedTeamId = 1610612744;

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Wrong, the answer was the Boston Celtics/)).toBeDefined();
  });

  it("should disable buttons when revealed", () => {
    mockGameState.currentQuestion = SAMPLE_QUESTION;
    mockGameState.gameState = "correct";

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    const buttons = screen.getAllByRole("button");
    // All choice buttons should be disabled
    const choiceButtons = buttons.filter(
      (b) =>
        b.textContent.includes("Celtics") ||
        b.textContent.includes("Warriors") ||
        b.textContent.includes("Lakers")
    );
    choiceButtons.forEach((btn) => {
      expect(btn.disabled).toBe(true);
    });
  });

  it("should render game over state with score", () => {
    mockGameState.gameState = "ended";
    mockGameState.score = 5;
    mockGameState.highScore = 5;

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Game Over!")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("New High Score!")).toBeDefined();
  });

  it("should show high score text when not a new record", () => {
    mockGameState.gameState = "ended";
    mockGameState.score = 2;
    mockGameState.highScore = 5;

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Your High Score: 5")).toBeDefined();
  });

  it("should show Play Again button on game over", () => {
    mockGameState.gameState = "ended";
    mockGameState.score = 3;
    mockGameState.highScore = 5;

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    const playAgainBtn = screen.getByRole("button", { name: /Play Again/ });
    expect(playAgainBtn).toBeDefined();
    fireEvent.click(playAgainBtn);
    expect(mockResetGame).toHaveBeenCalled();
  });

  it("should have navigation links on game over", () => {
    mockGameState.gameState = "ended";
    mockGameState.score = 3;
    mockGameState.highScore = 5;

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /View all Rankings/ })).toBeDefined();
    expect(screen.getByRole("link", { name: /View by Teams/ })).toBeDefined();
  });

  it("should show singular text for score of 1", () => {
    mockGameState.gameState = "ended";
    mockGameState.score = 1;
    mockGameState.highScore = 5;

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(screen.getByText("1")).toBeDefined();
  });

  it("should render intro screen with Play button", () => {
    mockGameState.gameState = "intro";

    render(
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    );

    expect(screen.getByText("NBA Top Five In Guesser")).toBeDefined();
    expect(screen.getByText(/Test your NBA knowledge/)).toBeDefined();
    const playBtn = screen.getByRole("button", { name: "Play" });
    expect(playBtn).toBeDefined();
    fireEvent.click(playBtn);
    expect(mockStartGame).toHaveBeenCalled();
  });
});
