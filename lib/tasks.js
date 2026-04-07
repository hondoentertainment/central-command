/**
 * Task data model and storage for Central Command.
 * localStorage key: "central-command.tasks.v1"
 */

const STORAGE_KEY = "central-command.tasks.v1";

const VALID_STATUSES = ["inbox", "today", "in-progress", "done", "archived"];
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];
const VALID_RECURRING = [null, "daily", "weekly", "monthly"];

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

/**
 * Load tasks from localStorage.
 * @returns {Array} Array of task objects
 */
export function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save tasks to localStorage.
 * @param {Array} tasks
 */
export function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // storage full or unavailable
  }
}

/**
 * Create a new task object.
 * @param {Object} opts
 * @returns {Object} New task object
 */
export function createTask({
  title,
  status,
  priority,
  dueDate,
  projectId,
  toolIds,
  notes,
  recurring,
} = {}) {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: title || "",
    status: VALID_STATUSES.includes(status) ? status : "inbox",
    priority: VALID_PRIORITIES.includes(priority) ? priority : "medium",
    dueDate: dueDate || null,
    projectId: projectId || null,
    toolIds: Array.isArray(toolIds) ? toolIds : [],
    notes: notes || "",
    recurring: VALID_RECURRING.includes(recurring) ? recurring : null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

/**
 * Update a task in the array (immutable).
 * @param {Array} tasks
 * @param {string} id
 * @param {Object} updates
 * @returns {Array} New array with updated task
 */
export function updateTask(tasks, id, updates) {
  return tasks.map((t) => {
    if (t.id !== id) return t;
    return { ...t, ...updates, updatedAt: new Date().toISOString() };
  });
}

/**
 * Delete a task from the array (immutable).
 * @param {Array} tasks
 * @param {string} id
 * @returns {Array} Filtered array
 */
export function deleteTask(tasks, id) {
  return tasks.filter((t) => t.id !== id);
}

/**
 * Get today's date as YYYY-MM-DD.
 */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

/**
 * Get tasks due today.
 * @param {Array} tasks
 * @returns {Array}
 */
export function getTasksDueToday(tasks) {
  const today = todayStr();
  return tasks.filter((t) => t.dueDate === today);
}

/**
 * Get tasks by status.
 * @param {Array} tasks
 * @param {string} status
 * @returns {Array}
 */
export function getTasksByStatus(tasks, status) {
  return tasks.filter((t) => t.status === status);
}

/**
 * Get tasks for a specific project.
 * @param {Array} tasks
 * @param {string} projectId
 * @returns {Array}
 */
export function getTasksForProject(tasks, projectId) {
  return tasks.filter((t) => t.projectId === projectId);
}

/**
 * Get overdue tasks (dueDate before today and status not "done").
 * @param {Array} tasks
 * @returns {Array}
 */
export function getOverdueTasks(tasks) {
  const today = todayStr();
  return tasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "archived"
  );
}

/**
 * Process recurring tasks. For each completed recurring task whose last completion
 * was before the current period, clone a new instance with today's date and status "inbox".
 * @param {Array} tasks
 * @returns {Array} Updated tasks array (may include new cloned tasks)
 */
export function processRecurringTasks(tasks) {
  const today = todayStr();
  const newTasks = [];

  for (const task of tasks) {
    if (!task.recurring || task.status !== "done" || !task.completedAt) continue;

    const completedDate = task.completedAt.slice(0, 10);
    let shouldClone = false;

    if (task.recurring === "daily") {
      shouldClone = completedDate < today;
    } else if (task.recurring === "weekly") {
      const completed = new Date(completedDate);
      const now = new Date(today);
      const diffDays = Math.floor((now - completed) / (1000 * 60 * 60 * 24));
      shouldClone = diffDays >= 7;
    } else if (task.recurring === "monthly") {
      const completed = new Date(completedDate);
      const now = new Date(today);
      shouldClone =
        now.getFullYear() > completed.getFullYear() ||
        (now.getFullYear() === completed.getFullYear() && now.getMonth() > completed.getMonth());
    }

    if (shouldClone) {
      // Check if a clone for this period already exists
      const existingClone = tasks.find(
        (t) =>
          t.id !== task.id &&
          t.title === task.title &&
          t.recurring === task.recurring &&
          t.status === "inbox" &&
          t.dueDate === today
      );
      if (!existingClone) {
        newTasks.push(
          createTask({
            title: task.title,
            status: "inbox",
            priority: task.priority,
            dueDate: today,
            projectId: task.projectId,
            toolIds: task.toolIds,
            notes: task.notes,
            recurring: task.recurring,
          })
        );
      }
    }
  }

  return newTasks.length > 0 ? [...newTasks, ...tasks] : tasks;
}
