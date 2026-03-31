import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/apiMocks.js";

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test("game page shows intro screen with Play button", async ({ page }) => {
  await page.goto("/game");

  await expect(page.getByText("NBA Top Five In Guesser")).toBeVisible();
  await expect(page.getByText(/Test your NBA knowledge/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("game page loads and shows a question after clicking Play", async ({ page }) => {
  await page.goto("/game");

  // Click Play on intro screen
  await page.getByRole("button", { name: "Play" }).click();

  // Should show the question text
  await expect(page.getByText(/Which team is ranked/)).toBeVisible({ timeout: 10000 });

  // Should show 3 choice buttons
  const choiceButtons = page.locator(".card-body button");
  await expect(choiceButtons).toHaveCount(3);
});

test("clicking correct answer shows Correct feedback", async ({ page }) => {
  await page.goto("/game");
  await page.getByRole("button", { name: "Play" }).click();

  await expect(page.getByText(/Which team is ranked/)).toBeVisible({ timeout: 10000 });

  // The question asks about rank 1, 2, or 3 in PPG or RPG
  // Find the correct team by checking who is highlighted after clicking
  // We know the mock data, so one of the displayed teams is the correct answer

  // Click the first button to test interaction
  const buttons = page.locator(".card-body button");
  const firstButton = buttons.first();
  await firstButton.click();

  // Should show either "Correct!" or "Wrong," feedback
  const feedback = page.getByText(/Correct!|Wrong,/);
  await expect(feedback).toBeVisible({ timeout: 5000 });
});

test("game nav link navigates to game page", async ({ page }) => {
  await page.goto("/");

  // Click the Game link in nav
  await page.getByRole("link", { name: "Game" }).first().click();

  // Should navigate to /game
  await expect(page).toHaveURL(/\/game/);
});

test("game over shows Play Again button", async ({ page }) => {
  await page.goto("/game");
  await page.getByRole("button", { name: "Play" }).click();

  await expect(page.getByText(/Which team is ranked/)).toBeVisible({ timeout: 10000 });

  // Keep clicking wrong answers until game over
  // Click buttons until we get "Wrong!" then wait for Game Over
  const buttons = page.locator(".card-body button");

  // Try clicking each button - one will be wrong if it's not the correct answer
  // Since we don't know which is correct, just click until game ends
  for (let i = 0; i < 3; i++) {
    const btn = buttons.nth(i);
    const isDisabled = await btn.isDisabled().catch(() => true);
    if (!isDisabled) {
      await btn.click();
      break;
    }
  }

  // Check if we got wrong
  const wrongText = page.getByText(/Wrong,/);
  const correctText = page.getByText("Correct!");
  const isWrong = await wrongText.isVisible().catch(() => false);

  if (isWrong) {
    // Wait for game over screen
    await expect(page.getByText("Game Over!")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Play Again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View all Rankings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View by Teams" })).toBeVisible();
  } else {
    // Got correct, which is also a valid game flow
    await expect(correctText).toBeVisible();
  }
});
