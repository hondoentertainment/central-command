// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Tasks page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with title and empty state', async ({ page }) => {
    await expect(page).toHaveTitle(/Tasks/i);
    await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible();
    const emptyState = page.locator('#taskEmpty');
    await expect(emptyState).toBeVisible();
  });

  test('create a task via the add form', async ({ page }) => {
    const taskName = `Test Task ${Date.now()}`;

    await page.locator('#addTaskBtn').click();
    await expect(page.locator('#taskFormWrap')).toBeVisible();

    await page.locator('#taskTitle').fill(taskName);
    await page.locator('#taskForm button[type="submit"]').click();

    // Form should close
    await expect(page.locator('#taskFormWrap')).toBeHidden();

    // Task should appear in the list
    await expect(page.locator('.task-card__title', { hasText: taskName })).toBeVisible({ timeout: 5000 });

    // Empty state should be hidden
    await expect(page.locator('#taskEmpty')).toBeHidden();
  });

  test('change task status from inbox to in-progress to done', async ({ page }) => {
    const taskName = `Status Flow ${Date.now()}`;

    // Create a task (defaults to inbox)
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskTitle').fill(taskName);
    await page.locator('#taskForm button[type="submit"]').click();
    await expect(page.locator('.task-card__title', { hasText: taskName })).toBeVisible({ timeout: 5000 });

    // Edit the task to change status to in-progress
    const taskCard = page.locator('.task-card').filter({ hasText: taskName });
    await taskCard.locator('[data-edit]').click();
    await expect(page.locator('#taskFormWrap')).toBeVisible();
    await page.locator('#taskStatus').selectOption('in-progress');
    await page.locator('#taskForm button[type="submit"]').click();
    await expect(page.locator('#taskFormWrap')).toBeHidden();

    // Click the "In Progress" filter to verify the task is there
    await page.locator('.task-filter-chip', { hasText: 'In Progress' }).click();
    await expect(page.locator('.task-card__title', { hasText: taskName })).toBeVisible();

    // Mark done via the checkbox
    const checkbox = page.locator('.task-card').filter({ hasText: taskName }).locator('.task-card__checkbox');
    await checkbox.check();

    // Switch to done filter to see it
    await page.locator('.task-filter-chip', { hasText: 'Done' }).click();
    await expect(page.locator('.task-card__title', { hasText: taskName })).toBeVisible();
    await expect(page.locator('.task-card').filter({ hasText: taskName })).toHaveClass(/task-card--done/);
  });

  test('set task priority', async ({ page }) => {
    const taskName = `Priority Task ${Date.now()}`;

    // Create a task with high priority
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskTitle').fill(taskName);
    await page.locator('#taskPriority').selectOption('high');
    await page.locator('#taskForm button[type="submit"]').click();

    await expect(page.locator('.task-card__title', { hasText: taskName })).toBeVisible({ timeout: 5000 });

    // Verify the priority badge is displayed
    const taskCard = page.locator('.task-card').filter({ hasText: taskName });
    await expect(taskCard.locator('.task-card__priority--high')).toBeVisible();
    await expect(taskCard.locator('.task-card__priority')).toHaveText('High');

    // Edit and change to critical
    await taskCard.locator('[data-edit]').click();
    await expect(page.locator('#taskFormWrap')).toBeVisible();
    await page.locator('#taskPriority').selectOption('critical');
    await page.locator('#taskForm button[type="submit"]').click();

    await expect(page.locator('.task-card').filter({ hasText: taskName }).locator('.task-card__priority--critical')).toBeVisible();
  });

  test('task persists after page reload', async ({ page }) => {
    const taskName = `Persist Task ${Date.now()}`;

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskTitle').fill(taskName);
    await page.locator('#taskForm button[type="submit"]').click();
    await expect(page.locator('.task-card__title', { hasText: taskName })).toBeVisible({ timeout: 5000 });

    // Reload and verify it's still there
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.task-card__title', { hasText: taskName })).toBeVisible({ timeout: 5000 });
  });
});
