import assert from "node:assert";
import { searchPages, searchRunbook, searchTools } from "../lib/command-palette.js";

const tools = [
  { name: "Notion", category: "Productivity", description: "Docs and notes" },
  { name: "ESPN", category: "Sports", description: "Scores and news" },
];

assert.strictEqual(searchTools(tools, "not").length, 1);
assert.strictEqual(searchTools(tools, "sports").length, 1);
assert.strictEqual(searchTools(tools, "missing").length, 0);

const runbookMatches = searchRunbook("Morning checklist\nReview ESPN scores\nShip deploy", "espn");
assert.strictEqual(runbookMatches.length, 1);
assert.strictEqual(runbookMatches[0].lineIndex, 1);

const pageMatches = searchPages("settings", "index.html");
assert.ok(pageMatches.some((page) => page.href === "settings.html"));
assert.ok(pageMatches.every((page) => page.href !== "index.html"));

const defaultPages = searchPages("", "settings.html");
assert.ok(defaultPages.length > 0);
assert.ok(defaultPages.every((page) => page.href !== "settings.html"));

console.log("command-palette.test.js: all assertions passed");
export default { ok: true };
