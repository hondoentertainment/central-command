// @ts-check
import { test, expect } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe("Mobile navigation", () => {
  test("header pages collapse into a menu drawer", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/profile.html");
    await page.waitForLoadState("domcontentloaded");

    const menuButton = page.locator(".page-nav__menu-btn");
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    await expect(page.locator(".page-nav-bar.is-open #pageNav")).toBeVisible();
    await expect(page.locator("#pageNav [data-key='settings']")).toBeVisible();
    await expect(page.locator("#pageNav .page-nav__palette-btn")).toBeVisible();
  });

  test("hamburger menu: nav links and command palette button are visible and usable", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/registry.html");
    await page.waitForLoadState("domcontentloaded");

    const menuButton = page.locator(".page-nav__menu-btn");
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const nav = page.locator(".page-nav-bar.is-open #pageNav");
    await expect(nav).toBeVisible();
    await expect(nav.locator("[data-key='registry']")).toBeVisible();
    await expect(nav.locator("[data-key='profile']")).toBeVisible();
    const paletteBtn = nav.locator(".page-nav__palette-btn");
    await expect(paletteBtn).toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(page.locator(".command-palette-overlay")).toBeVisible();
  });

  test("home page on mobile viewport has sidebar nav and palette button in DOM (compact/collapsed ok)", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("#pageNav.page-nav--sidebar")).toHaveCount(1);
    await expect(page.locator("#pageNav .page-nav__palette-btn")).toHaveCount(1);
    await expect(page.locator("#pageNav .sidebar-brand")).toHaveCount(1);
  });
});
