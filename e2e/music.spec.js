// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Music — Rolling Stone 500", () => {
  test("music page loads with RS500 panel, filters, and album grid", async ({ page }) => {
    await page.goto("/music.html");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { level: 1, name: /Rolling Stone Top 500/i })).toBeVisible();
    await expect(page.locator(".panel--music")).toBeVisible();
    await expect(page.locator("#rs500Genre")).toBeVisible();
    await expect(page.locator("#rs500Decade")).toBeVisible();
    await expect(page.locator("#rs500Grid")).toBeVisible();
    await expect(page.locator("#rs500Count")).toContainText(/Showing \d+ of 50 albums/);

    const cards = page.locator(".rs500-card");
    await expect(cards.first()).toBeVisible();
    await expect(cards).toHaveCount(50);
  });

  test("genre filter reduces visible albums", async ({ page }) => {
    await page.goto("/music.html");
    await page.waitForLoadState("domcontentloaded");

    await page.locator("#rs500Genre").selectOption("Hip-Hop");
    await expect(page.locator("#rs500Count")).toContainText(/Showing \d+ of 50 albums/);
    const cards = page.locator(".rs500-card");
    const count = await cards.count();
    expect(count).toBeLessThan(50);
    expect(count).toBeGreaterThan(0);
  });

  test("decade filter reduces visible albums", async ({ page }) => {
    await page.goto("/music.html");
    await page.waitForLoadState("domcontentloaded");

    await page.locator("#rs500Decade").selectOption("1970s");
    await expect(page.locator("#rs500Count")).toContainText(/Showing \d+ of 50 albums/);
    const cards = page.locator(".rs500-card");
    const count = await cards.count();
    expect(count).toBeLessThan(50);
    expect(count).toBeGreaterThan(0);
  });

  test("album card links to Spotify", async ({ page }) => {
    await page.goto("/music.html");
    await page.waitForLoadState("domcontentloaded");

    const firstCard = page.locator(".rs500-card").first();
    await expect(firstCard).toHaveAttribute("href", /open\.spotify\.com/);
    await expect(firstCard).toHaveAttribute("target", "_blank");
  });
});
