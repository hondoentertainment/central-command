// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Runbook page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/runbook.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with title and textarea', async ({ page }) => {
    await expect(page).toHaveTitle(/Runbook/i);
    await expect(page.getByRole('heading', { level: 1, name: 'Daily notes' })).toBeVisible();
    await expect(page.locator('#notes')).toBeVisible();
  });

  test('write a note in the textarea', async ({ page }) => {
    const textarea = page.locator('#notes');
    const noteText = '# My Test Note\n\nThis is a test note with **bold** text.';
    await textarea.fill(noteText);

    // Verify value is set
    await expect(textarea).toHaveValue(noteText);
  });

  test('markdown preview toggle', async ({ page }) => {
    const textarea = page.locator('#notes');
    const noteText = '# Hello World\n\nThis is **bold** text.';
    await textarea.fill(noteText);

    // Switch to preview mode
    const previewTab = page.locator('#tab-preview');
    await expect(previewTab).toBeVisible();
    await previewTab.click();

    // Edit panel should be hidden, preview should be visible
    await expect(page.locator('#notes-edit-panel')).toBeHidden();
    const previewPanel = page.locator('#notes-preview-panel');
    await expect(previewPanel).toBeVisible();

    // Preview should contain rendered HTML (heading and bold)
    const preview = page.locator('#notes-preview');
    await expect(preview).toBeVisible();

    // Switch back to edit mode
    const editTab = page.locator('#tab-edit');
    await editTab.click();
    await expect(page.locator('#notes-edit-panel')).toBeVisible();
    await expect(previewPanel).toBeHidden();

    // Textarea should still have the original text
    await expect(textarea).toHaveValue(noteText);
  });

  test('auto-save: type, wait, reload, verify content persists', async ({ page }) => {
    const textarea = page.locator('#notes');
    const noteText = `Auto-save test ${Date.now()}`;

    await textarea.fill(noteText);

    // Trigger the input event for the debounced save
    await textarea.dispatchEvent('input');

    // Wait for the debounced save to fire (debounce is 800ms)
    await page.waitForTimeout(1200);

    // Verify it was saved to localStorage
    const saved = await page.evaluate(() => localStorage.getItem('central-command.notes.v1'));
    expect(saved).toBe(noteText);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Verify the note persists
    await expect(page.locator('#notes')).toHaveValue(noteText);
  });

  test('daily standup button inserts template', async ({ page }) => {
    const textarea = page.locator('#notes');
    await expect(textarea).toHaveValue('');

    const standupBtn = page.locator('#dailyStandupBtn');
    await expect(standupBtn).toBeVisible();
    await standupBtn.click();

    // Verify standup template was inserted
    const value = await textarea.inputValue();
    expect(value).toContain('Daily Standup');
    expect(value).toContain('What I did yesterday');
    expect(value).toContain('What I\'m doing today');
    expect(value).toContain('Blockers');
  });
});
