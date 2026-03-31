import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/apiMocks.js";

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test("loads teams grid with both team cards", async ({ page }) => {
  await page.goto("/teams");

  // Page heading
  await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();

  // Both teams rendered (sorted alphabetically, so Boston first then Brooklyn)
  await expect(page.getByText("Boston Celtics")).toBeVisible();
  await expect(page.getByText("Brooklyn Nets")).toBeVisible();
});

test("team cards show trophy count", async ({ page }) => {
  await page.goto("/teams");

  // Wait for teams to load
  await expect(page.getByText("Boston Celtics")).toBeVisible();

  // Both cards show trophy icon
  const trophyElements = page.locator("text=🏆");
  await expect(trophyElements.first()).toBeVisible();

  // BOS mock has 2 trophies (PPG rank=1, RPG rank=4), BKN has 1 trophy (RPG rank=8)
  await expect(page.getByText("×2").first()).toBeVisible();
  await expect(page.getByText("×1").first()).toBeVisible();
});

test("clicking a team card navigates to team detail page", async ({ page }) => {
  await page.goto("/teams");

  // Wait for teams grid
  await expect(page.getByText("Boston Celtics")).toBeVisible();

  // Click the BOS card link
  await page.getByText("Boston Celtics").click();

  // URL should change to /team/BOS
  await expect(page).toHaveURL(/\/team\/BOS/i);
});
