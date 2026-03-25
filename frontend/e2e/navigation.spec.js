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
