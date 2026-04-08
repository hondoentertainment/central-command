// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'sample-backup.json');
const FIXTURE_JSON = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

/** Serve the fixture backup.json so the app auto-loads tools. */
async function setupRoutes(page) {
  await page.route('**/backup.json', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE_JSON) });
  });
}

/** Wait for the app shell to be ready. */
async function waitForAppReady(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#toolGrid')).toBeVisible();
  await page.waitForTimeout(1000);
}

test.describe('Visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await setupRoutes(page);
  });

  test('command deck in dark theme', async ({ page }) => {
    await page.goto('/');
    // Ensure dark theme
    await page.evaluate(() => {
      localStorage.setItem('central-command.theme', 'dark');
    });
    await page.reload();
    await waitForAppReady(page);
    await page.locator('#importBackupInput').setInputFiles(FIXTURE_PATH);
    await expect(page.locator('.tool-card').first()).toBeVisible({ timeout: 5000 });

    await expect(page).toHaveScreenshot('command-deck-dark.png', {
      maxDiffPixelRatio: 0.002,
    });
  });

  test('command deck in light theme', async ({ page }) => {
    await page.goto('/');
    // Set light theme
    await page.evaluate(() => {
      localStorage.setItem('central-command.theme', 'light');
    });
    await page.reload();
    await waitForAppReady(page);
    await page.locator('#importBackupInput').setInputFiles(FIXTURE_PATH);
    await expect(page.locator('.tool-card').first()).toBeVisible({ timeout: 5000 });

    await expect(page).toHaveScreenshot('command-deck-light.png', {
      maxDiffPixelRatio: 0.002,
    });
  });

  test('registry page layout', async ({ page }) => {
    await page.goto('/registry.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#toolForm')).toBeVisible();

    await expect(page).toHaveScreenshot('registry-layout.png', {
      maxDiffPixelRatio: 0.002,
    });
  });

  test('command deck mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('central-command.theme', 'dark');
    });
    await page.reload();
    await waitForAppReady(page);
    await page.locator('#importBackupInput').setInputFiles(FIXTURE_PATH);
    await expect(page.locator('.tool-card').first()).toBeVisible({ timeout: 5000 });

    await expect(page).toHaveScreenshot('command-deck-mobile.png', {
      maxDiffPixelRatio: 0.002,
    });
  });
});
