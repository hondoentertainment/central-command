/**
 * Generates backup.json from the Full Command preset (PRESET_PACKS[0]).
 * Format: { tools: [...], launchHistory: [], notes: "" }
 * Compatible with fetchAndImportBackup in app.js.
 */
import { PRESET_PACKS } from "../data/presets.js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const preset = PRESET_PACKS[0];
const tools = preset.tools.map((t) => ({
  id: t.id,
  name: t.name,
  url: t.url,
  category: t.category,
  description: t.description,
  accent: t.accent ?? "amber",
  pinned: t.pinned ?? false,
  pinRank: t.pinned ? (t.pinRank ?? null) : null,
  surfaces: t.surfaces ?? [],
  iconKey: t.iconKey ?? "auto",
  shortcutLabel: t.shortcutLabel ?? "",
  openMode: t.openMode ?? "new-tab",
}));

const backup = { tools, launchHistory: [], notes: "" };
const outPath = join(__dirname, "..", "backup.json");
writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf8");
console.log(`Wrote ${tools.length} tools to backup.json`);
