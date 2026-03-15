// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Command palette navigation", () => {
  test("opens from header search button", async ({ page }) => {
    await page.goto("/registry.html");
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: /search/i }).first().click();
    await expect(page.locator(".command-palette-overlay")).toBeVisible();
    await expect(page.locator(".command-palette-item").first()).toBeVisible();
  });

  test("shows page results for site navigation", async ({ page }) => {
    await page.goto("/registry.html");
    await page.waitForLoadState("domcontentloaded");

    await page.keyboard.press("Control+K");
    await expect(page.locator(".command-palette-overlay")).toBeVisible();

    const input = page.locator(".command-palette-input");
    await input.fill("settings");
    await expect(page.getByRole("option").filter({ hasText: "Open Settings" })).toBeVisible();
    await expect(page.getByRole("option").filter({ hasText: "Page" }).first()).toBeVisible();
  });
});
