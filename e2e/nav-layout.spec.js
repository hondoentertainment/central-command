// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Navigation layout variants", () => {
  test("index uses sidebar navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("#pageNav.page-nav--sidebar")).toBeVisible();
    await expect(page.locator("#pageNav .sidebar-brand")).toBeVisible();
    await expect(page.locator("#pageNav [data-key='profile']")).toBeVisible();
    await expect(page.locator("#pageNav [data-key='settings']")).toBeVisible();
    await expect(page.locator("#pageNav [data-key='admin']")).toBeVisible();
  });

  for (const route of ["/registry.html", "/profile.html", "/settings.html"]) {
    test(`${route} uses header navigation`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("#pageNav.page-nav--header")).toBeVisible();
      await expect(page.locator("#pageNav .header-nav-links")).toBeVisible();
      await expect(page.locator("#pageNav .sidebar-brand")).toHaveCount(0);
      await expect(page.locator("#pageNav [data-key='profile']")).toBeVisible();
      await expect(page.locator("#pageNav [data-key='settings']")).toBeVisible();
      await expect(page.locator("#pageNav [data-key='admin']")).toBeVisible();
    });
  }
});
