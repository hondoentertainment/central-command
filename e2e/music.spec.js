// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Music", () => {
  test("music page loads with link to Rolling Stone list", async ({ page }) => {
    await page.goto("/music.html");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { level: 1, name: "Music" })).toBeVisible();
    await expect(page.locator(".panel--music")).toBeVisible();
    const link = page.getByRole("link", { name: /Open Rolling Stone Top 500/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /preview-rs500-spotify|rollingstone|spotify/i);
    await expect(link).toHaveAttribute("target", "_blank");
  });
});
