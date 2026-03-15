// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Mobile navigation", () => {
  test("header pages collapse into a menu drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/profile.html");
    await page.waitForLoadState("domcontentloaded");

    const menuButton = page.locator(".page-nav__menu-btn");
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    await expect(page.locator(".page-nav-bar.is-open #pageNav")).toBeVisible();
    await expect(page.locator("#pageNav [data-key='settings']")).toBeVisible();
    await expect(page.locator("#pageNav .page-nav__palette-btn")).toBeVisible();
  });
});
