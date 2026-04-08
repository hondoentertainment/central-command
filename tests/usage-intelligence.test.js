import assert from "node:assert";
import {
  getSuggestedTools,
  getStaleTools,
  getWeeklyDigest,
  getTimeBlockLabel,
  shouldShowDigest,
  shouldShowStaleNudge,
} from "../lib/usage-intelligence.js";

// --- getTimeBlockLabel ---
assert.strictEqual(getTimeBlockLabel(0), "Night");
assert.strictEqual(getTimeBlockLabel(3), "Night");
assert.strictEqual(getTimeBlockLabel(5), "Night");
assert.strictEqual(getTimeBlockLabel(6), "Morning");
assert.strictEqual(getTimeBlockLabel(11), "Morning");
assert.strictEqual(getTimeBlockLabel(12), "Afternoon");
assert.strictEqual(getTimeBlockLabel(17), "Afternoon");
assert.strictEqual(getTimeBlockLabel(18), "Evening");
assert.strictEqual(getTimeBlockLabel(23), "Evening");

// --- getSuggestedTools ---

const tools = [
  { id: "a", name: "Tool A" },
  { id: "b", name: "Tool B" },
  { id: "c", name: "Tool C" },
  { id: "d", name: "Tool D" },
];

// Empty history returns no suggestions
const emptyResult = getSuggestedTools(tools, [], 10);
assert.strictEqual(emptyResult.label, "Morning");
assert.strictEqual(emptyResult.tools.length, 0);

// History with enough launches in morning block (6-11) -> returns block-specific tools
const morningHistory = [
  { toolId: "a", launchedAt: "2026-04-07T08:00:00.000Z", count: 3 },
  { toolId: "b", launchedAt: "2026-04-07T09:30:00.000Z", count: 2 },
  { toolId: "c", launchedAt: "2026-04-06T07:00:00.000Z", count: 1 },
];
// Total block launches = 3 + 2 + 1 = 6 >= 5 -> uses block data
const morningResult = getSuggestedTools(tools, morningHistory, 8);
assert.strictEqual(morningResult.label, "Morning");
assert.ok(morningResult.tools.length > 0);
assert.strictEqual(morningResult.tools[0].id, "a"); // highest count

// Insufficient block data falls back to overall most-used
const eveningHistory = [
  { toolId: "a", launchedAt: "2026-04-07T20:00:00.000Z", count: 1 },
  { toolId: "b", launchedAt: "2026-04-07T08:00:00.000Z", count: 10 },
];
// Evening block has only 1 launch (< 5), should fall back
const eveningResult = getSuggestedTools(tools, eveningHistory, 20);
assert.strictEqual(eveningResult.label, "Evening");
assert.ok(eveningResult.tools.length > 0);
assert.strictEqual(eveningResult.tools[0].id, "b"); // most launches overall

// Returns max 5 tools
const manyHistory = Array.from({ length: 10 }, (_, i) => ({
  toolId: String.fromCharCode(97 + i),
  launchedAt: "2026-04-07T09:00:00.000Z",
  count: 1,
}));
const manyTools = Array.from({ length: 10 }, (_, i) => ({
  id: String.fromCharCode(97 + i),
  name: `Tool ${i}`,
}));
const manyResult = getSuggestedTools(manyTools, manyHistory, 9);
assert.ok(manyResult.tools.length <= 5);

// --- getStaleTools ---

const now = new Date();
const recentDate = new Date(now);
recentDate.setDate(recentDate.getDate() - 5);
const oldDate = new Date(now);
oldDate.setDate(oldDate.getDate() - 45);

const staleTools = [
  { id: "a", name: "Tool A", pinned: false },
  { id: "b", name: "Tool B", pinned: true },
  { id: "c", name: "Tool C", pinned: false },
  { id: "d", name: "Tool D", pinned: false },
];

const staleHistory = [
  { toolId: "a", launchedAt: recentDate.toISOString(), count: 1 },
  { toolId: "c", launchedAt: oldDate.toISOString(), count: 1 },
];

const staleResult = getStaleTools(staleTools, staleHistory, 30);
// Tool A launched recently -> not stale
// Tool B pinned -> excluded
// Tool C launched 45 days ago -> stale
// Tool D never launched -> stale
assert.ok(staleResult.length === 2);
assert.strictEqual(staleResult[0].tool.id, "c"); // oldest first
assert.strictEqual(staleResult[1].tool.id, "d"); // never launched at end

// Pinned tools are excluded even if never launched
const pinnedOnly = [{ id: "x", name: "X", pinned: true }];
assert.deepStrictEqual(getStaleTools(pinnedOnly, [], 30), []);

// --- getWeeklyDigest ---

const weekTools = [
  { id: "a", name: "Tool A", category: "Dev" },
  { id: "b", name: "Tool B", category: "Design" },
  { id: "c", name: "Tool C", category: "Dev" },
];

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const twoDaysAgo = new Date(today);
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
const tenDaysAgo = new Date(today);
tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

const weekHistory = [
  { toolId: "a", launchedAt: today.toISOString(), count: 3 },
  { toolId: "b", launchedAt: yesterday.toISOString(), count: 2 },
  { toolId: "a", launchedAt: twoDaysAgo.toISOString(), count: 1 },
  { toolId: "c", launchedAt: tenDaysAgo.toISOString(), count: 5 }, // outside week
];

const digest = getWeeklyDigest(weekTools, weekHistory);
assert.strictEqual(digest.totalLaunches, 6); // 3 + 2 + 1 (c is outside week)
assert.ok(digest.topTools.length > 0);
assert.strictEqual(digest.topTools[0].tool.id, "a"); // 3 + 1 = 4 launches
assert.ok(digest.streak >= 1); // today has a launch
assert.ok(Array.isArray(digest.categoryBreakdown));
assert.ok(digest.categoryBreakdown.length > 0);

// Category breakdown percentages should sum to approximately 100
const totalPct = digest.categoryBreakdown.reduce((sum, c) => sum + c.percentage, 0);
assert.ok(totalPct >= 98 && totalPct <= 102); // rounding tolerance

// Dev category should have higher count (4 vs 2)
const devCat = digest.categoryBreakdown.find((c) => c.category === "Dev");
assert.ok(devCat);
assert.strictEqual(devCat.count, 4);

// Empty history produces zeroes
const emptyDigest = getWeeklyDigest(weekTools, []);
assert.strictEqual(emptyDigest.totalLaunches, 0);
assert.strictEqual(emptyDigest.streak, 0);
assert.strictEqual(emptyDigest.topTools.length, 0);

console.log("All usage-intelligence tests passed.");
