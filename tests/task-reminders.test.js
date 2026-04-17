import assert from "node:assert";

const store = {};
global.localStorage = {
  getItem(key) { return store[key] ?? null; },
  setItem(key, value) { store[key] = String(value); },
  removeItem(key) { delete store[key]; },
  clear() { Object.keys(store).forEach((k) => delete store[k]); },
};

const {
  collectTasksDueToday,
  isNotificationSupported,
  getNotificationPermission,
} = await import("../lib/task-reminders.js");

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

// Notifications are unavailable in node.
assert.strictEqual(isNotificationSupported(), false);
assert.strictEqual(getNotificationPermission(), "unsupported");

const today = todayStr();
const tasks = [
  { id: "a", title: "Due today", dueDate: today, status: "inbox" },
  { id: "b", title: "Due today done", dueDate: today, status: "done" },
  { id: "c", title: "Due today archived", dueDate: today, status: "archived" },
  { id: "d", title: "Due tomorrow", dueDate: "2099-12-31", status: "inbox" },
  { id: "e", title: "No due date", status: "inbox" },
];

localStorage.clear();
const { dueTasks, commit } = collectTasksDueToday(tasks);
assert.strictEqual(dueTasks.length, 1, "only active tasks due today are returned");
assert.strictEqual(dueTasks[0].id, "a");

// Commit ids and ensure subsequent calls skip them (same day).
commit(["a"]);
const second = collectTasksDueToday(tasks);
assert.strictEqual(second.dueTasks.length, 0, "already-reminded ids are filtered out");

// Simulate a new day by rewriting storage under a stale date.
localStorage.setItem(
  "central-command.task-reminders.v1",
  JSON.stringify({ date: "1999-01-01", ids: ["a"] })
);
const third = collectTasksDueToday(tasks);
assert.strictEqual(third.dueTasks.length, 1, "stale reminder records are discarded");

// Malformed payloads degrade gracefully.
localStorage.setItem("central-command.task-reminders.v1", "not json");
const fourth = collectTasksDueToday(tasks);
assert.strictEqual(fourth.dueTasks.length, 1);

// persistDueTodaySnapshot produces a valid payload shape and no-ops IDB when
// IndexedDB is unavailable in the Node runtime.
const { persistDueTodaySnapshot, registerReminderPeriodicSync } = await import(
  "../lib/task-reminders.js"
);

// No global navigator / serviceWorker in Node — should report unsupported.
const regResult = await registerReminderPeriodicSync();
assert.strictEqual(regResult, "unsupported");

// persistDueTodaySnapshot returns a snapshot even when IDB is unavailable.
localStorage.clear();
const snapshot = await persistDueTodaySnapshot(tasks);
assert.strictEqual(snapshot.date, today);
assert.strictEqual(snapshot.tasks.length, 1);
assert.strictEqual(snapshot.tasks[0].id, "a");
assert.ok(Array.isArray(snapshot.remindedIds));
assert.ok(snapshot.savedAt);

// Completed and archived tasks are pruned from the snapshot.
const onlyFinished = [
  { id: "x", title: "Done today", dueDate: today, status: "done" },
  { id: "y", title: "Archived", dueDate: today, status: "archived" },
];
const prunedSnapshot = await persistDueTodaySnapshot(onlyFinished);
assert.strictEqual(prunedSnapshot.tasks.length, 0);

console.log("task-reminders.test.js: all assertions passed");
export default { ok: true };
