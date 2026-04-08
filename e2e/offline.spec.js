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

test.describe('Offline scenarios', () => {
  test('app loads from service worker cache when offline', async ({ page, context }) => {
    await setupRoutes(page);

    // First load: let the service worker install and cache assets
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#toolGrid')).toBeVisible();

    // Import tools so they're in localStorage
    await page.locator('#importBackupInput').setInputFiles(FIXTURE_PATH);
    await expect(page.locator('.tool-card').first()).toBeVisible({ timeout: 5000 });

    // Wait for service worker to be active
    await page.waitForTimeout(2000);

    // Simulate offline by aborting all network requests
    await context.setOffline(true);

    // Reload the page while offline - service worker should serve cached assets
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Verify the command deck still renders
    await expect(page.locator('#toolGrid')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('tool launch opens URL while offline', async ({ page, context }) => {
    await setupRoutes(page);

    // Load the app and import tools
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#importBackupInput').setInputFiles(FIXTURE_PATH);
    await expect(page.locator('.tool-card').filter({ hasText: 'E2E Test Tool Alpha' })).toBeVisible({ timeout: 5000 });

    // Wait for service worker to cache everything
    await page.waitForTimeout(2000);

    // Go offline
    await context.setOffline(true);

    // Reload from cache
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#toolGrid')).toBeVisible({ timeout: 10000 });

    // Click the launch button - it should attempt to open the URL (new tab)
    const launchButton = page.locator('.tool-card').filter({ hasText: 'E2E Test Tool Alpha' }).locator('.launch-button');
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      launchButton.click(),
    ]);

    // The new tab will open (even if the target URL fails to load, the action still works)
    expect(popup).toBeTruthy();
    await popup.close();
  });

  test('localStorage operations work offline', async ({ page, context }) => {
    await setupRoutes(page);

    // Load the app online first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#toolGrid')).toBeVisible();

    // Wait for service worker
    await page.waitForTimeout(2000);

    // Go offline
    await context.setOffline(true);

    // Reload from cache
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#toolGrid')).toBeVisible({ timeout: 10000 });

    // Write and read from localStorage
    const result = await page.evaluate(() => {
      const testKey = 'central-command.offline-test';
      const testValue = JSON.stringify({ test: true, ts: Date.now() });
      localStorage.setItem(testKey, testValue);
      const read = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return read === testValue;
    });

    expect(result).toBe(true);
  });
});
