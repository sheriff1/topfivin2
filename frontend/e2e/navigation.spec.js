import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/apiMocks.js";

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test("logo click navigates to home from /teams", async ({ page }) => {
  await page.goto("/teams");

  // Click the logo link
  await page.getByRole("link", { name: /NBA Top Five In/i }).click();

  // Should navigate to /
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: /Rankings$/i }).first()).toBeVisible();
});

test("Rankings tab is active at /", async ({ page }) => {
  await page.goto("/");

  // Rankings link has active highlight
  const rankingsLink = page.getByRole("link", { name: "Rankings", exact: true });
  await expect(rankingsLink).toHaveClass(/bg-primary-content/);

  // Other links are not active
  const teamsLink = page.getByRole("link", { name: "Teams", exact: true });
  await expect(teamsLink).not.toHaveClass(/bg-primary-content/);
});

test("Teams tab navigates to /teams", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Teams" }).click();

  await expect(page).toHaveURL("/teams");
  await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
});

test("dev-only tabs (Audit, Games Count) are not visible in production", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Audit" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Games Count" })).not.toBeVisible();
});

test("season label comes from the API, not a hardcoded value", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/about");
  await expect(page.getByText(/for the 2026-27 NBA season/)).toBeVisible();
  // The season picker lists 2025-26 as a choice, so only check the About text itself
  await expect(page.getByText(/for the 2025-26 NBA season/)).toHaveCount(0);
});

test("season picker switches the season used by the API requests", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/about");
  await expect(page.getByText(/for the 2026-27 NBA season/)).toBeVisible();

  await page.getByRole("combobox", { name: "Season" }).first().selectOption("2025");
  await expect(page.getByText(/for the 2025-26 NBA season/)).toBeVisible();
});

test("tab title follows the page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("NBA Top Five In");

  await page.getByRole("link", { name: "Teams" }).click();
  await expect(page).toHaveTitle("NBA Top Five In | Teams");

  await page.getByRole("link", { name: "Rankings", exact: true }).click();
  await expect(page).toHaveTitle("NBA Top Five In");
});
