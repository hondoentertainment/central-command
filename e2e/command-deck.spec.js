import { test, expect } from "@playwright/test";

test.describe("Command Deck (index page)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Clear localStorage for a clean state
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("loads the page with title", async ({ page }) => {
    await expect(page).toHaveTitle(/Central Command/i);
  });

  test("search input filters tools", async ({ page }) => {
    const searchInput = page.locator("#searchInput");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("nonexistent-tool-xyz");
    // Should show empty state
    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible();
  });

  test("filter chips render and are clickable", async ({ page }) => {
    const filterBar = page.locator("#filterBar");
    await expect(filterBar).toBeVisible();
    const allChip = filterBar.locator("button", { hasText: "All" });
    await expect(allChip).toBeVisible();
    await allChip.click();
    await expect(allChip).toHaveClass(/is-active/);
  });

  test("layout toggle switches views", async ({ page }) => {
    const listBtn = page.locator('[data-layout="list"]');
    if (await listBtn.isVisible()) {
      await listBtn.click();
      const grid = page.locator("#toolGrid");
      await expect(grid).toHaveClass(/tool-grid--list/);
    }
  });

  test("theme toggle works", async ({ page }) => {
    const themeBtn = page.locator(".theme-toggle");
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      expect(["light", "dark"]).toContain(theme);
    }
  });
});

test.describe("Quick Add Tool", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("quick add form opens and submits", async ({ page }) => {
    const addBtn = page.locator("#addToolBtn");
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const wrap = page.locator("#quickAddFormWrap");
      await expect(wrap).toBeVisible();

      await page.locator("#quickAddName").fill("Test Tool");
      await page.locator("#quickAddUrl").fill("https://example.com");
      await page.locator("#quickAddForm").evaluate((form) => form.requestSubmit());

      // Tool should appear in grid
      const toolCard = page.locator(".tool-card__title", { hasText: "Test Tool" });
      await expect(toolCard).toBeVisible();
    }
  });
});

test.describe("Navigation", () => {
  test("nav links are present", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("#pageNav");
    await expect(nav).toBeVisible();
    await expect(nav.locator('a[data-key="command"]')).toBeVisible();
    await expect(nav.locator('a[data-key="registry"]')).toBeVisible();
    await expect(nav.locator('a[data-key="runbook"]')).toBeVisible();
  });

  test("navigate to registry", async ({ page }) => {
    await page.goto("/registry.html");
    const form = page.locator("#toolForm");
    await expect(form).toBeVisible();
  });

  test("navigate to runbook", async ({ page }) => {
    await page.goto("/runbook.html");
    const notes = page.locator("#notes");
    await expect(notes).toBeVisible();
  });
});

test.describe("Runbook", () => {
  test("type notes and switch to preview", async ({ page }) => {
    await page.goto("/runbook.html");
    const textarea = page.locator("#notes");
    await textarea.fill("# Hello World\n\nThis is a test.");

    const previewTab = page.locator("#tab-preview");
    if (await previewTab.isVisible()) {
      await previewTab.click();
      const preview = page.locator("#notes-preview");
      await expect(preview).toBeVisible();
    }
  });
});

test.describe("Command Palette", () => {
  test("Cmd+K opens command palette", async ({ page }) => {
    await page.goto("/");
    // Focus body first (not an input)
    await page.click("body");
    await page.keyboard.press("Control+k");
    const overlay = page.locator(".command-palette-overlay");
    await expect(overlay).toBeVisible();

    // Escape closes it
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
  });
});

test.describe("Registry Import/Export", () => {
  test("export button generates a download", async ({ page }) => {
    await page.goto("/registry.html");
    const exportBtn = page.locator("#exportButton");
    if (await exportBtn.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        exportBtn.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/central-command-backup/);
    }
  });
});
