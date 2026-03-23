import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/apiMocks.js";

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test("logo click navigates to home from /audit", async ({ page }) => {
  await page.goto("/audit");

  // Click the logo link
  await page.getByRole("link", { name: /NBA Stats Rankings/i }).click();

  // Should navigate to /
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: /Points Per Game Rankings - 2025-26 Season/i })
  ).toBeVisible();
});

test("Rankings tab is active at /", async ({ page }) => {
  await page.goto("/");

  // Rankings tab has tab-active class (exact: true avoids matching the logo link)
  const rankingsTab = page.getByRole("link", { name: "Rankings", exact: true });
  await expect(rankingsTab).toHaveClass(/tab-active/);

  // Other tabs are not active
  const teamsTab = page.getByRole("link", { name: "Teams", exact: true });
  await expect(teamsTab).not.toHaveClass(/tab-active/);
});

test("Teams tab navigates to /teams", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Teams" }).click();

  await expect(page).toHaveURL("/teams");
  await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
});

test("Audit tab navigates to /audit", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Audit" }).click();

  await expect(page).toHaveURL("/audit");
  await expect(page.getByRole("heading", { name: "Total Games" })).toBeVisible();
});
