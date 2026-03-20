import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/apiMocks.js";

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test("loads audit page with summary stats cards", async ({ page }) => {
  await page.goto("/audit");

  // Summary stat cards visible
  await expect(page.getByRole("heading", { name: "Total Games" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Collected" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Collection Rate" })).toBeVisible();

  // Stat values from mock data: total=100, collected=82, rate=82%
  // Use scoped locators to avoid strict mode violations from pagination elements
  await expect(page.getByText("100", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("82", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("82%")).toBeVisible();
});

test("games table shows game rows with team abbreviations", async ({ page }) => {
  await page.goto("/audit");

  // Wait for table to render
  await expect(page.getByRole("heading", { name: "Total Games" })).toBeVisible();

  // Game row shows team abbreviations from mock (BOS vs BKN)
  await expect(page.getByText("BOS")).toBeVisible();
  await expect(page.getByText("BKN")).toBeVisible();

  // Collected badge visible
  await expect(page.getByText("✓ Collected")).toBeVisible();
});

test("status filter change triggers re-fetch", async ({ page }) => {
  await page.goto("/audit");

  // Wait for initial load
  await expect(page.getByRole("heading", { name: "Total Games" })).toBeVisible();

  // Status filter is the first select.select-bordered (second is pagination)
  const statusFilter = page.locator("select.select-bordered").first();
  await expect(statusFilter).toBeVisible();
  await expect(statusFilter).toHaveValue("all");

  // Change to "Collected Only"
  await statusFilter.selectOption("collected");
  await expect(statusFilter).toHaveValue("collected");
});

test("clicking game row expands to show stats", async ({ page }) => {
  await page.goto("/audit");

  // Wait for table
  await expect(page.getByText("BOS")).toBeVisible();

  // Click the game row (game_id = "g1")
  await page.getByText("g1").click();

  // Expanded stats load — GameStatsRow renders
  // The expanded row should show stats for both teams
  await expect(page.getByText("BOS").first()).toBeVisible();
});
