// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Accessibility smoke", () => {
  test("index has main landmark, one h1, and focus reaches key controls", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const main = page.getByRole("main");
    await expect(main).toBeVisible();

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
    await expect(h1).toHaveCount(1);

    await page.waitForSelector("main a[href], main button, a[href]", { state: "visible", timeout: 5000 });
    const focusable = page.locator("main a[href], main button").first();
    await focusable.focus();
    await expect(focusable).toBeFocused();
  });

  test("registry has main landmark, one h1, and tab order reaches key controls", async ({ page }) => {
    await page.goto("/registry.html");
    await page.waitForLoadState("domcontentloaded");

    const main = page.getByRole("main");
    await expect(main).toBeVisible();

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
    await expect(h1).toHaveCount(1);

    await page.keyboard.press("Tab");
    let focused = await page.evaluate(() => document.activeElement?.tagName);
    const focusableTags = ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"];
    const reachedFocusable = focusableTags.includes(focused);
    expect(reachedFocusable).toBeTruthy();
  });
});
