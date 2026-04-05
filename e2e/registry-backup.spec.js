// @ts-check
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "fixtures", "sample-backup.json");

test.describe("Registry backup flow", () => {
  test("import fixture via Tools page then export JSON backup", async ({ page }) => {
    await page.goto("/registry");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: /add or update tools/i })).toBeVisible();

    await page.locator("#importButton").click();
    await page.locator("#importFileInput").setInputFiles(FIXTURE_PATH);

    await expect(page.locator(".form-message.is-success")).toContainText(/imported/i, { timeout: 8000 });
    await expect(page.locator(".form-message.is-success")).toContainText(/3/i);

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#exportButton").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^central-command-backup-[\d-]+\.json$/);

    const savePath = path.join(os.tmpdir(), `cc-e2e-export-${Date.now()}.json`);
    try {
      await download.saveAs(savePath);
      const raw = fs.readFileSync(savePath, "utf8");
      const payload = JSON.parse(raw);
      expect(payload.version).toBe(2);
      expect(Array.isArray(payload.tools)).toBeTruthy();
      expect(payload.tools.length).toBeGreaterThanOrEqual(3);
      const names = payload.tools.map((t) => t.name);
      expect(names).toContain("E2E Test Tool Alpha");
    } finally {
      try {
        fs.unlinkSync(savePath);
      } catch {
        /* ignore */
      }
    }
  });
});
