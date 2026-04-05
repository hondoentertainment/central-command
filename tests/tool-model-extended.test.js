import assert from "node:assert";
import {
  sanitizeTool,
  hydrateTools,
  sortTools,
  normalizePinRanks,
  getNextPinRank,
  movePinnedTool,
  recordLaunch,
  filterHistoryForTools,
  sanitizeLaunchHistory,
  formatLaunchTime,
  createFallbackMetadataMap,
  getToolSignature,
} from "../lib/tool-model.js";

// --- hydrateTools ---
assert.deepStrictEqual(hydrateTools(null, new Map()), []);
assert.deepStrictEqual(hydrateTools("not array", new Map()), []);
assert.deepStrictEqual(hydrateTools([null, undefined, {}], new Map()), []);

const validTools = [
  { name: "A", url: "https://a.com", category: "Test", description: "d" },
  { name: "B", url: "https://b.com", category: "Test", description: "d" },
];
const hydrated = hydrateTools(validTools, new Map());
assert.strictEqual(hydrated.length, 2);

// --- sortTools ---
const unsorted = [
  { name: "Z", pinned: false, pinRank: null },
  { name: "A", pinned: true, pinRank: 2 },
  { name: "B", pinned: true, pinRank: 1 },
];
const sorted = sortTools(unsorted);
assert.strictEqual(sorted[0].name, "B");
assert.strictEqual(sorted[1].name, "A");
assert.strictEqual(sorted[2].name, "Z");

// --- normalizePinRanks ---
const withBadRanks = [
  { id: "1", name: "A", pinned: true, pinRank: 99 },
  { id: "2", name: "B", pinned: true, pinRank: 5 },
  { id: "3", name: "C", pinned: false, pinRank: null },
];
const normalized = normalizePinRanks(withBadRanks);
const pinnedNorm = normalized.filter((t) => t.pinned).sort((a, b) => a.pinRank - b.pinRank);
assert.strictEqual(pinnedNorm[0].pinRank, 1);
assert.strictEqual(pinnedNorm[1].pinRank, 2);
assert.strictEqual(normalized.find((t) => t.id === "3").pinRank, null);

// --- getNextPinRank ---
assert.strictEqual(getNextPinRank(normalized), 3);
assert.strictEqual(getNextPinRank([]), 1);

// --- movePinnedTool ---
const tools3 = [
  { id: "1", name: "A", pinned: true, pinRank: 1 },
  { id: "2", name: "B", pinned: true, pinRank: 2 },
  { id: "3", name: "C", pinned: true, pinRank: 3 },
];
const movedDown = movePinnedTool(tools3, "1", "down");
const pinnedMoved = sortTools(movedDown).filter((t) => t.pinned);
assert.strictEqual(pinnedMoved[0].id, "2");
assert.strictEqual(pinnedMoved[1].id, "1");

const movedUp = movePinnedTool(tools3, "3", "up");
const pinnedMovedUp = sortTools(movedUp).filter((t) => t.pinned);
assert.strictEqual(pinnedMovedUp[1].id, "3");
assert.strictEqual(pinnedMovedUp[2].id, "2");

// --- recordLaunch ---
const emptyHistory = [];
const afterFirst = recordLaunch(emptyHistory, "tool-1");
assert.strictEqual(afterFirst.length, 1);
assert.strictEqual(afterFirst[0].toolId, "tool-1");
assert.strictEqual(afterFirst[0].count, 1);

const afterSecond = recordLaunch(afterFirst, "tool-1");
assert.strictEqual(afterSecond.length, 1);
assert.strictEqual(afterSecond[0].count, 2);

// --- filterHistoryForTools ---
const historyEntries = [
  { toolId: "1", launchedAt: new Date().toISOString(), count: 1 },
  { toolId: "gone", launchedAt: new Date().toISOString(), count: 1 },
];
const filteredHistory = filterHistoryForTools(historyEntries, [{ id: "1" }]);
assert.strictEqual(filteredHistory.length, 1);
assert.strictEqual(filteredHistory[0].toolId, "1");

// --- sanitizeLaunchHistory ---
assert.deepStrictEqual(sanitizeLaunchHistory(null), []);
assert.deepStrictEqual(sanitizeLaunchHistory("bad"), []);
const sanitized = sanitizeLaunchHistory([
  { toolId: "a", launchedAt: new Date().toISOString(), count: 3 },
  { toolId: "", launchedAt: "bad", count: 1 },
  null,
]);
assert.strictEqual(sanitized.length, 1);

// --- formatLaunchTime ---
const formatted = formatLaunchTime(new Date().toISOString());
assert.strictEqual(typeof formatted, "string");
assert.ok(formatted.length > 0);

// --- createFallbackMetadataMap & getToolSignature ---
const presets = [
  { name: "Gmail", url: "https://mail.google.com", category: "Comms", description: "d", accent: "teal" },
];
const map = createFallbackMetadataMap(presets);
assert.strictEqual(map.size, 1);
assert.strictEqual(map.get(getToolSignature(presets[0])).accent, "teal");

// --- sanitizeTool with fallback ---
const withFallback = sanitizeTool(
  { name: "Gmail", url: "https://mail.google.com", category: "Comms", description: "d" },
  { accent: "teal" }
);
assert.strictEqual(withFallback.accent, "teal");

console.log("tool-model-extended.test.js: all assertions passed");
export default { ok: true };
