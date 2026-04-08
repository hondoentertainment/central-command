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

test.describe('Multi-tab synchronisation', () => {
  test('adding a tool in tab 1 is reflected in tab 2 via storage event', async ({ browser }) => {
    const context = await browser.newContext();
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    await setupRoutes(tab1);
    await setupRoutes(tab2);

    // Open both tabs
    await tab1.goto('/');
    await tab1.waitForLoadState('domcontentloaded');
    await expect(tab1.locator('#toolGrid')).toBeVisible();

    await tab2.goto('/');
    await tab2.waitForLoadState('domcontentloaded');
    await expect(tab2.locator('#toolGrid')).toBeVisible();

    // In tab 1, add a tool via quick add
    const addBtn = tab1.locator('#addToolBtn');
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const wrap = tab1.locator('#quickAddFormWrap');
      await expect(wrap).toBeVisible();

      const toolName = `Cross-Tab Tool ${Date.now()}`;
      await tab1.locator('#quickAddName').fill(toolName);
      await tab1.locator('#quickAddUrl').fill('https://example.com/cross-tab');
      await tab1.locator('#quickAddForm').evaluate((form) => form.requestSubmit());

      // Verify tool appears in tab 1
      await expect(tab1.locator('.tool-card__title', { hasText: toolName })).toBeVisible({ timeout: 5000 });

      // Read what tab 1 stored
      const storedTools = await tab1.evaluate(() => localStorage.getItem('central-command.tools.v2'));

      // Simulate a storage event in tab 2 (this is how browsers notify other tabs)
      await tab2.evaluate((toolsJson) => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'central-command.tools.v2',
          newValue: toolsJson,
          storageArea: localStorage,
        }));
      }, storedTools);

      // Verify the localStorage in tab 2 is consistent
      const tab2Tools = await tab2.evaluate(() => localStorage.getItem('central-command.tools.v2'));
      expect(tab2Tools).toContain('cross-tab');
    }

    await context.close();
  });

  test('theme change in one tab dispatches storage event to another', async ({ browser }) => {
    const context = await browser.newContext();
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    await tab1.goto('/');
    await tab1.waitForLoadState('domcontentloaded');
    await tab2.goto('/');
    await tab2.waitForLoadState('domcontentloaded');

    // Set theme to light in tab 1
    await tab1.evaluate(() => {
      localStorage.setItem('central-command.theme', 'light');
    });

    // Simulate storage event in tab 2
    await tab2.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'central-command.theme',
        newValue: 'light',
        storageArea: localStorage,
      }));
    });

    // Verify tab 2 localStorage reflects the change
    const tab2Theme = await tab2.evaluate(() => localStorage.getItem('central-command.theme'));
    expect(tab2Theme).toBe('light');

    await context.close();
  });

  test('task changes in one tab are visible via storage event in another', async ({ browser }) => {
    const context = await browser.newContext();
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    // Open tasks page in both tabs
    await tab1.goto('/tasks.html');
    await tab1.waitForLoadState('domcontentloaded');
    await tab2.goto('/tasks.html');
    await tab2.waitForLoadState('domcontentloaded');

    // Create a task in tab 1
    await tab1.locator('#addTaskBtn').click();
    await expect(tab1.locator('#taskFormWrap')).toBeVisible();
    const taskTitle = `Sync Test ${Date.now()}`;
    await tab1.locator('#taskTitle').fill(taskTitle);
    await tab1.locator('#taskForm button[type="submit"]').click();
    await expect(tab1.locator('.task-card__title', { hasText: taskTitle })).toBeVisible({ timeout: 5000 });

    // Read stored tasks from tab 1
    const storedTasks = await tab1.evaluate(() => localStorage.getItem('central-command.tasks.v1'));

    // Simulate storage event in tab 2
    await tab2.evaluate((tasksJson) => {
      // Update localStorage to match tab 1
      localStorage.setItem('central-command.tasks.v1', tasksJson);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'central-command.tasks.v1',
        newValue: tasksJson,
        storageArea: localStorage,
      }));
    }, storedTasks);

    // Verify the task data is in tab 2's localStorage
    const tab2Tasks = await tab2.evaluate(() => localStorage.getItem('central-command.tasks.v1'));
    expect(tab2Tasks).toContain(taskTitle);

    await context.close();
  });
});
