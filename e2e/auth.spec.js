// @ts-check
import { test, expect } from "@playwright/test";

const authEmail = process.env.E2E_AUTH_EMAIL;
const authPassword = process.env.E2E_AUTH_PASSWORD;

test.describe("Auth flows", () => {
  test.skip(!authEmail || !authPassword, "Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD to run auth e2e.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/settings.html");
    await page.waitForLoadState("domcontentloaded");
  });

  test("sign in and sign out", async ({ page }) => {
    const loginToggle = page.getByRole("button", { name: "Log in" });
    await loginToggle.click();

    await page.getByPlaceholder("Email").fill(authEmail || "");
    await page.getByPlaceholder("Password").fill(authPassword || "");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Signed in:")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible({ timeout: 15000 });
  });

  test("request password reset", async ({ page }) => {
    const loginToggle = page.getByRole("button", { name: "Log in" });
    await loginToggle.click();
    await page.getByPlaceholder("Email").fill(authEmail || "");
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText("Password reset email sent.")).toBeVisible({ timeout: 15000 });
  });
});
