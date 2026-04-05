// @ts-check
import { test, expect } from "@playwright/test";

/**
 * Verifies serve.json rewrites (local dev / CI) match production Vercel extensionless routes.
 */
const ROUTES = [
  { path: "/registry", heading: /add or update tools/i },
  { path: "/music", heading: /curated music picks/i },
  { path: "/movies", heading: /movie tracking and markets/i },
  { path: "/parties", heading: /party planning/i },
  { path: "/sports", heading: /scores, news, and coverage/i },
  { path: "/health", heading: /wellness and training tools/i },
  { path: "/admin", heading: /site update and maintenance tools/i },
  { path: "/profile", heading: /your command profile/i },
  { path: "/settings", heading: /preferences and appearance/i },
];

test.describe("Extensionless routes (serve + Vercel parity)", () => {
  for (const { path: urlPath, heading } of ROUTES) {
    test(`${urlPath} serves HTML`, async ({ page }) => {
      const response = await page.goto(urlPath);
      expect(response?.ok()).toBeTruthy();
      await page.waitForLoadState("domcontentloaded");

      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    });
  }
});
