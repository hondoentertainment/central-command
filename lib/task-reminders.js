/**
 * Browser-notification reminders for tasks due today. Reminders fire from two
 * places:
 *
 *   1. The Tasks page on load (immediate, in-page): useful while the tab is
 *      already open.
 *   2. A service-worker `periodicsync` event (background): the page writes a
 *      snapshot of due-today tasks to IndexedDB; the SW reads it on schedule
 *      and fires notifications directly without a live tab.
 *
 * The feature is strictly opt-in: users must grant Notification permission.
 * We only remind once per task per day by tracking reminded IDs keyed by the
 * local date; both code paths share the same storage so announcements are not
 * duplicated when the page happens to be open during a periodicsync.
 */

import {
  saveDueTodaySnapshot,
  clearDueTodaySnapshot,
} from "./reminder-store.js";

const REMINDER_STORAGE_KEY = "central-command.task-reminders.v1";

function todayStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function readRemindedIds() {
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
    if (!raw) return { date: todayStr(), ids: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { date: todayStr(), ids: [] };
    if (parsed.date !== todayStr()) return { date: todayStr(), ids: [] };
    return { date: parsed.date, ids: Array.isArray(parsed.ids) ? parsed.ids : [] };
  } catch {
    return { date: todayStr(), ids: [] };
  }
}

function writeRemindedIds(ids) {
  try {
    localStorage.setItem(
      REMINDER_STORAGE_KEY,
      JSON.stringify({ date: todayStr(), ids: Array.from(new Set(ids)).slice(-200) })
    );
  } catch {
    // storage full or unavailable
  }
}

export function isNotificationSupported() {
  return typeof Notification !== "undefined";
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Prompts the user for permission. Returns the resulting permission string,
 * or "unsupported" if the browser has no Notification API.
 * @returns {Promise<"granted"|"denied"|"default"|"unsupported">}
 */
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "default";
  }
}

/**
 * Selects tasks that should trigger a reminder now: due today, not already
 * done/archived, and not reminded earlier today. Returns the subset plus a
 * helper to commit the reminded state once notifications have been shown.
 * @param {Array} tasks
 * @returns {{ dueTasks: Array, commit: (ids: string[]) => void }}
 */
export function collectTasksDueToday(tasks) {
  const today = todayStr();
  const { ids: alreadyReminded } = readRemindedIds();
  const remindedSet = new Set(alreadyReminded);

  const dueTasks = (tasks || []).filter((task) => {
    if (!task || typeof task !== "object") return false;
    if (task.dueDate !== today) return false;
    if (task.status === "done" || task.status === "archived") return false;
    if (!task.id || remindedSet.has(task.id)) return false;
    return true;
  });

  return {
    dueTasks,
    commit(extraIds = []) {
      writeRemindedIds([...alreadyReminded, ...extraIds]);
    },
  };
}

/**
 * Shows a reminder notification for each task and records their IDs so the
 * same tasks are not re-announced on the next page load today.
 * @param {Array} tasks
 * @param {Object} [options]
 * @param {(n: Notification) => void} [options.onClick] - optional click handler
 * @returns {number} number of notifications dispatched
 */
export function showDueTodayReminders(tasks, { onClick } = {}) {
  if (!isNotificationSupported() || Notification.permission !== "granted") return 0;

  const { dueTasks, commit } = collectTasksDueToday(tasks);
  if (dueTasks.length === 0) return 0;

  const notifiedIds = [];
  for (const task of dueTasks) {
    try {
      const n = new Notification(`Task due today: ${task.title}`, {
        body: task.notes || "Open Central Command to complete this task.",
        tag: `cc-task-${task.id}`,
        silent: task.priority === "low",
      });
      if (typeof onClick === "function") n.onclick = () => onClick(n);
      notifiedIds.push(task.id);
    } catch {
      // browser rejected; skip this task
    }
  }

  if (notifiedIds.length > 0) commit(notifiedIds);
  return notifiedIds.length;
}

/**
 * Shapes a task list into the minimal snapshot stored in IndexedDB for the
 * service worker. Only active tasks due today are kept, plus the set of IDs
 * already reminded this session (so the SW does not re-announce them).
 */
function buildSnapshotPayload(tasks) {
  const today = todayStr();
  const { ids: alreadyReminded } = readRemindedIds();
  const due = (tasks || []).filter(
    (task) =>
      task &&
      task.dueDate === today &&
      task.status !== "done" &&
      task.status !== "archived" &&
      task.id
  );
  return {
    date: today,
    savedAt: new Date().toISOString(),
    remindedIds: alreadyReminded,
    tasks: due.map((task) => ({
      id: task.id,
      title: task.title || "",
      notes: task.notes || "",
      priority: task.priority || "medium",
      dueDate: task.dueDate,
    })),
  };
}

/**
 * Writes the current due-today snapshot to IndexedDB so the service worker
 * can announce reminders while the tab is closed. Safe to call on every task
 * mutation; returns the snapshot it persisted.
 */
export async function persistDueTodaySnapshot(tasks) {
  const snapshot = buildSnapshotPayload(tasks);
  await saveDueTodaySnapshot(snapshot);
  return snapshot;
}

export async function clearPersistedSnapshot() {
  await clearDueTodaySnapshot();
}

const PERIODIC_SYNC_TAG = "central-command.task-reminders";

/**
 * Asks the service worker to wake periodically and announce due-today
 * reminders. Silently no-ops on browsers without periodic background sync.
 * Returns `"registered"`, `"unsupported"`, or `"denied"`.
 */
export async function registerReminderPeriodicSync() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return "unsupported";
  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.periodicSync || typeof registration.periodicSync.register !== "function") {
      return "unsupported";
    }
    if (typeof navigator.permissions?.query === "function") {
      try {
        const status = await navigator.permissions.query({ name: "periodic-background-sync" });
        if (status.state !== "granted") return "denied";
      } catch {
        // Some browsers don't expose this permission name; fall through.
      }
    }
    await registration.periodicSync.register(PERIODIC_SYNC_TAG, {
      minInterval: 6 * 60 * 60 * 1000, // every 6 hours
    });
    return "registered";
  } catch {
    return "denied";
  }
}

export async function unregisterReminderPeriodicSync() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.periodicSync?.unregister?.(PERIODIC_SYNC_TAG);
  } catch {
    // ignore
  }
}

export const REMINDER_PERIODIC_SYNC_TAG = PERIODIC_SYNC_TAG;
