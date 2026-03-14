// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'sample-backup.json');
const FIXTURE_JSON = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

/** Ensure backup.json is available for app auto-load on first visit */
async function setupRoutes(page) {
  await page.route('**/backup.json', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE_JSON) });
  });
}

/** Wait for app shell to load. */
async function waitForAppReady(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1, name: 'Central Command' })).toBeVisible();
  await expect(page.locator('#toolGrid')).toBeVisible();
  await expect(page.getByPlaceholder('Search tools or categories')).toBeVisible();
  await page.waitForTimeout(2000);
}

test.describe('Central Command Home', () => {
  test.beforeEach(async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('a) Home page loads and shows tool grid', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Central Command' })).toBeVisible();
    await expect(page.locator('#toolGrid')).toBeVisible();
    const toolCards = page.locator('#toolGrid .tool-card');
    const emptyState = page.locator('#toolGrid .empty-state');
    const skeletons = page.locator('#toolGrid .skeleton-card');
    const hasContent = (await toolCards.count()) > 0 || (await emptyState.count()) > 0 || (await skeletons.count()) > 0;
    expect(hasContent).toBeTruthy();
  });

  test('b) Search filters tools - type in search, verify results change', async ({ page }) => {
    const cards = page.locator('.tool-card');
    const initialCount = await cards.count();
    if (initialCount === 0) {
      await page.locator('#importBackupInput').setInputFiles(FIXTURE_PATH);
      await expect(page.locator('.tool-card').filter({ hasText: 'E2E Test Tool Alpha' })).toBeVisible({ timeout: 5000 });
    }

    const searchInput = page.getByPlaceholder('Search tools or categories');
    const countBefore = await page.locator('.tool-card').count();

    await searchInput.fill('Alpha');
    await page.waitForTimeout(400);
    await expect(page.locator('.tool-card').filter({ hasText: 'Alpha' })).toBeVisible();
    const countAlpha = await page.locator('.tool-card').count();
    expect(countAlpha).toBeLessThanOrEqual(countBefore);

    await searchInput.fill('xyznonexistent123');
    await page.waitForTimeout(400);
    const emptyCount = await page.locator('.tool-card').count();
    expect(emptyCount).toBe(0);
  });

  test('c) Add tool via quick add - fill form, submit, verify new tool appears', async ({ page }) => {
    const uniqueName = `E2E Quick Add ${Date.now()}`;
    const uniqueUrl = 'https://example.com/e2e-' + Date.now();

    await page.getByRole('button', { name: 'Add tool' }).click();
    await expect(page.locator('#quickAddFormWrap')).toBeVisible({ timeout: 5000 });

    await page.locator('#quickAddName').fill(uniqueName);
    await page.locator('#quickAddUrl').fill(uniqueUrl);
    const categorySelect = page.locator('#quickAddCategory');
    const optionCount = await categorySelect.locator('option').count();
    if (optionCount > 1) {
      await categorySelect.selectOption({ index: 1 });
    }
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.locator('#quickAddFormWrap')).toBeHidden();
    await expect(page.locator('.tool-card').filter({ hasText: uniqueName })).toBeVisible({ timeout: 5000 });
  });

  test('d) Import backup - use fixture JSON, trigger import, verify tools loaded', async ({ page }) => {
    await page.locator('#importBackupInput').setInputFiles(FIXTURE_PATH);

    await expect(page.locator('.tool-card').filter({ hasText: 'E2E Test Tool Alpha' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.tool-card').filter({ hasText: 'E2E Test Tool Beta' })).toBeVisible();
    await expect(page.locator('.tool-card').filter({ hasText: 'E2E Searchable Gamma' })).toBeVisible();
  });

  test('e) Launch a tool - click Launch, verify new tab opens (new-tab tools)', async ({ page, context }) => {
    await page.locator('#importBackupInput').setInputFiles(FIXTURE_PATH);
    await expect(page.locator('.tool-card').filter({ hasText: 'E2E Test Tool Alpha' })).toBeVisible({ timeout: 5000 });

    const launchButton = page.locator('.tool-card').filter({ hasText: 'E2E Test Tool Alpha' }).locator('.launch-button');
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      launchButton.click(),
    ]);

    await expect(popup).toHaveURL(/example\.com/);
    await popup.close();
  });

  test('e2) Launch same-tab tool - verify same tab navigates', async ({ page }) => {
    await page.locator('#importBackupInput').setInputFiles(FIXTURE_PATH);
    await expect(page.locator('.tool-card').filter({ hasText: 'E2E Searchable Gamma' })).toBeVisible({ timeout: 5000 });

    const launchButton = page.locator('.tool-card').filter({ hasText: 'E2E Searchable Gamma' }).locator('.launch-button');
    await launchButton.click();
    await expect(page).toHaveURL(/example\.com/, { timeout: 5000 });
  });
});
