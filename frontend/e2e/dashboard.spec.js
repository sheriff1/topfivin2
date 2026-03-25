import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/apiMocks.js";

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test("loads with a rankings table and Top 5 showcase", async ({ page }) => {
  await page.goto("/");

  // Heading shows a random category (PPG or RPG in mocks)
  await expect(page.getByRole("heading", { name: /Rankings$/i }).first()).toBeVisible();

  // Top 5 Showcase section rendered (uses Top5Showcase component)
  await expect(page.getByText("Boston Celtics").first()).toBeVisible();

  // Rankings table has both teams
  await expect(page.getByText("Brooklyn Nets").first()).toBeVisible();
});

test("category dropdown change updates rankings heading to RPG", async ({ page }) => {
  await page.goto("/");

  // Wait for initial load (random category)
  await expect(page.getByRole("heading", { name: /Rankings$/i }).first()).toBeVisible();

  // Change category
  await page.locator("select.select-bordered").selectOption("RPG");

  // Heading updates
  await expect(page.getByRole("heading", { name: /Rebounds Per Game Rankings/i })).toBeVisible();

  // Brooklyn Nets is rank 1 in RPG mock data
  await expect(page.getByText("Brooklyn Nets").first()).toBeVisible();
});

test("ranks are displayed in the rankings table", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Rankings$/i }).first()).toBeVisible();

  // Rank badges visible in table (rendered as #1, #2)
  await expect(page.getByText("#1").first()).toBeVisible();
  await expect(page.getByText("#2").first()).toBeVisible();
});
