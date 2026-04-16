/**
 * Lightweight browser-notification reminders for tasks due today. The feature
 * is strictly opt-in: users must grant Notification permission, and we only
 * remind once per task per day by tracking a set of "reminded" task IDs keyed
 * by local date.
 *
 * No background scheduling: reminders fire on page init after processing
 * recurring tasks, so any page load during a relevant day triggers them. This
 * keeps the implementation static-hosting friendly with no service-worker
 * push dependency.
 */

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
