import { renderNav } from "./lib/nav.js";
import { showToast } from "./lib/toast.js";
import { showConfirmDialog } from "./lib/confirm-dialog.js";
import {
  loadTasks,
  saveTasks,
  createTask,
  updateTask,
  deleteTask as removeTask,
  getOverdueTasks,
  processRecurringTasks,
} from "./lib/tasks.js";
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  showDueTodayReminders,
} from "./lib/task-reminders.js";

const PROJECTS_KEY = "central-command.projects";

const STATUS_CONFIG = {
  inbox:         { label: "Inbox",       icon: "📥" },
  today:         { label: "Today",       icon: "☀️" },
  "in-progress": { label: "In Progress", icon: "🔨" },
  done:          { label: "Done",        icon: "✅" },
  archived:      { label: "Archived",    icon: "📦" },
};

const PRIORITY_CONFIG = {
  low:      { label: "Low",      color: "var(--muted)" },
  medium:   { label: "Medium",   color: "var(--amber)" },
  high:     { label: "High",     color: "var(--crimson)" },
  critical: { label: "Critical", color: "var(--crimson)" },
};

let tasks = [];
let projects = [];
let activeFilter = "all";
let editingId = null;

function loadProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return "";
  const today = todayStr();
  if (dateStr === today) return "Today";

  const d = new Date(dateStr + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  const diff = Math.floor((d - now) / (1000 * 60 * 60 * 24));

  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 7) return `In ${diff} days`;
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function init() {
  renderNav("tasks");
  tasks = loadTasks();
  projects = loadProjects();

  // Process recurring tasks
  const processed = processRecurringTasks(tasks);
  if (processed !== tasks) {
    tasks = processed;
    saveTasks(tasks);
  }

  document.getElementById("addTaskBtn")?.addEventListener("click", () => showForm());
  document.getElementById("taskCancelBtn")?.addEventListener("click", hideForm);
  document.getElementById("taskForm")?.addEventListener("submit", handleSubmit);

  bindReminderControls();
  bindKeyboardShortcuts();

  render();

  // Opportunistic due-today notifications (only when already granted).
  if (getNotificationPermission() === "granted") {
    showDueTodayReminders(tasks);
  }
}

function bindReminderControls() {
  const btn = document.getElementById("taskRemindersBtn");
  if (!btn) return;

  const refreshLabel = () => {
    if (!isNotificationSupported()) {
      btn.textContent = "Reminders unsupported";
      btn.disabled = true;
      return;
    }
    const perm = getNotificationPermission();
    if (perm === "granted") btn.textContent = "Reminders: on";
    else if (perm === "denied") btn.textContent = "Reminders: blocked";
    else btn.textContent = "Enable reminders";
  };

  refreshLabel();
  btn.addEventListener("click", async () => {
    if (!isNotificationSupported()) return;
    const perm = await requestNotificationPermission();
    refreshLabel();
    if (perm === "granted") {
      const count = showDueTodayReminders(tasks);
      showToast(
        count > 0
          ? `Reminders on. ${count} task${count === 1 ? "" : "s"} due today.`
          : "Reminders on. You'll be notified on your next visit."
      );
    } else if (perm === "denied") {
      showToast("Notifications are blocked in your browser settings.", "error");
    }
  });
}

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const active = document.activeElement;
    const isEditable =
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable);
    if (isEditable) return;

    const key = event.key?.toLowerCase();
    if (key === "n") {
      event.preventDefault();
      showForm();
      return;
    }
    if (key === "t") {
      event.preventDefault();
      activeFilter = "today";
      render();
      return;
    }
    if (key === "a") {
      event.preventDefault();
      activeFilter = "all";
      render();
      return;
    }
    if (key === "i") {
      event.preventDefault();
      activeFilter = "inbox";
      render();
    }
  });
}

function showForm(task = null) {
  const wrap = document.getElementById("taskFormWrap");
  const submitBtn = document.getElementById("taskSubmitBtn");
  if (!wrap) return;

  // Populate project dropdown
  const projectSelect = document.getElementById("taskProject");
  if (projectSelect) {
    projectSelect.innerHTML = '<option value="">No project</option>';
    projects.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });
  }

  if (task && typeof task === "object" && task.id) {
    editingId = task.id;
    document.getElementById("taskTitle").value = task.title || "";
    document.getElementById("taskNotes").value = task.notes || "";
    document.getElementById("taskStatus").value = task.status || "inbox";
    document.getElementById("taskPriority").value = task.priority || "medium";
    document.getElementById("taskDueDate").value = task.dueDate || "";
    if (projectSelect) projectSelect.value = task.projectId || "";
    document.getElementById("taskRecurring").value = task.recurring || "";
    submitBtn.textContent = "Save";
  } else {
    editingId = null;
    document.getElementById("taskForm").reset();
    submitBtn.textContent = "Add";
  }

  wrap.hidden = false;
  requestAnimationFrame(() => document.getElementById("taskTitle")?.focus());
}

function hideForm() {
  const wrap = document.getElementById("taskFormWrap");
  if (wrap) wrap.hidden = true;
  editingId = null;
}

function handleSubmit(e) {
  e.preventDefault();
  const title = document.getElementById("taskTitle")?.value?.trim();
  if (!title) return;

  const data = {
    title,
    notes: document.getElementById("taskNotes")?.value?.trim() || "",
    status: document.getElementById("taskStatus")?.value || "inbox",
    priority: document.getElementById("taskPriority")?.value || "medium",
    dueDate: document.getElementById("taskDueDate")?.value || null,
    projectId: document.getElementById("taskProject")?.value || null,
    recurring: document.getElementById("taskRecurring")?.value || null,
  };

  if (editingId) {
    tasks = updateTask(tasks, editingId, data);
    showToast("Task updated");
  } else {
    const newTask = createTask(data);
    tasks.unshift(newTask);
    showToast("Task added");
  }

  saveTasks(tasks);
  hideForm();
  render();
}

function handleDelete(id) {
  showConfirmDialog({
    title: "Delete this task?",
    message: "This task will be permanently removed.",
    confirmLabel: "Delete",
    destructive: true,
  }).then((confirmed) => {
    if (confirmed) {
      tasks = removeTask(tasks, id);
      saveTasks(tasks);
      showToast("Task deleted");
      render();
    }
  });
}

function toggleDone(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  if (task.status === "done") {
    // Restore to inbox (or previous meaningful status)
    tasks = updateTask(tasks, id, { status: "inbox", completedAt: null });
  } else {
    tasks = updateTask(tasks, id, { status: "done", completedAt: new Date().toISOString() });
  }

  saveTasks(tasks);
  render();
}

function getFilteredTasks() {
  const nonArchived = tasks.filter((t) => t.status !== "archived");
  if (activeFilter === "all") return nonArchived;
  if (activeFilter === "archived") return tasks.filter((t) => t.status === "archived");
  return nonArchived.filter((t) => t.status === activeFilter);
}

function renderFilterBar() {
  const bar = document.getElementById("taskFilterBar");
  if (!bar) return;

  const nonArchived = tasks.filter((t) => t.status !== "archived");
  const counts = {
    all: nonArchived.length,
    inbox: tasks.filter((t) => t.status === "inbox").length,
    today: tasks.filter((t) => t.status === "today").length,
    "in-progress": tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
    archived: tasks.filter((t) => t.status === "archived").length,
  };

  const filters = [
    { key: "all", label: "All" },
    { key: "inbox", label: "Inbox" },
    { key: "today", label: "Today" },
    { key: "in-progress", label: "In Progress" },
    { key: "done", label: "Done" },
    { key: "archived", label: "Archived" },
  ];

  bar.innerHTML = filters
    .map(
      (f) => `
    <button class="task-filter-chip ${activeFilter === f.key ? "task-filter-chip--active" : ""}" data-filter="${f.key}">
      <span class="task-filter-chip__count">${counts[f.key] || 0}</span>${f.label}
    </button>
  `
    )
    .join("");

  bar.querySelectorAll(".task-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      render();
    });
  });
}

function renderTaskList() {
  const list = document.getElementById("taskList");
  const empty = document.getElementById("taskEmpty");
  if (!list) return;

  const filtered = getFilteredTasks();
  if (empty) empty.hidden = filtered.length > 0;

  if (filtered.length === 0) {
    list.innerHTML = "";
    return;
  }

  const today = todayStr();
  const overdue = getOverdueTasks(tasks);
  const overdueIds = new Set(overdue.map((t) => t.id));

  // Group by status if showing all
  let html = "";
  if (activeFilter === "all") {
    const statusOrder = ["inbox", "today", "in-progress", "done"];
    for (const status of statusOrder) {
      const group = filtered.filter((t) => t.status === status);
      if (group.length === 0) continue;
      const cfg = STATUS_CONFIG[status];
      html += `<div class="task-group__header">${cfg.icon} ${cfg.label} (${group.length})</div>`;
      html += group.map((t) => renderTaskCard(t, today, overdueIds)).join("");
    }
  } else {
    html = filtered.map((t) => renderTaskCard(t, today, overdueIds)).join("");
  }

  list.innerHTML = html;

  // Attach event listeners
  list.querySelectorAll("[data-toggle]").forEach((cb) => {
    cb.addEventListener("change", () => toggleDone(cb.dataset.toggle));
  });
  list.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const task = tasks.find((t) => t.id === btn.dataset.edit);
      if (task) showForm(task);
    });
  });
  list.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => handleDelete(btn.dataset.delete));
  });
}

function renderTaskCard(task, today, overdueIds) {
  const isDone = task.status === "done";
  const isOverdue = overdueIds.has(task.id);
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  let dueDateHtml = "";
  if (task.dueDate) {
    const dueClass = isOverdue
      ? "task-card__due task-card__due--overdue"
      : task.dueDate === today
        ? "task-card__due task-card__due--today"
        : "task-card__due";
    dueDateHtml = `<span class="${dueClass}">${formatRelativeDate(task.dueDate)}</span>`;
  }

  let projectHtml = "";
  if (task.projectId) {
    const proj = projects.find((p) => p.id === task.projectId);
    if (proj) {
      projectHtml = `<a href="./projects.html" class="task-card__project">${escapeHtml(proj.name)}</a>`;
    }
  }

  let toolsHtml = "";
  if (task.toolIds && task.toolIds.length > 0) {
    const chips = task.toolIds
      .map((id) => `<span class="task-card__tool-chip">${escapeHtml(id)}</span>`)
      .join("");
    toolsHtml = `<div class="task-card__tools">${chips}</div>`;
  }

  let notesHtml = "";
  if (task.notes) {
    notesHtml = `<div class="task-card__notes">${escapeHtml(task.notes)}</div>`;
  }

  let recurringHtml = "";
  if (task.recurring) {
    const labels = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
    recurringHtml = `<span class="task-card__recurring">${labels[task.recurring] || task.recurring}</span>`;
  }

  const classes = [
    "task-card",
    isDone ? "task-card--done" : "",
    isOverdue ? "task-card--overdue" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${classes}" data-id="${task.id}">
      <input type="checkbox" class="task-card__checkbox" ${isDone ? "checked" : ""} data-toggle="${task.id}" aria-label="Mark ${isDone ? "incomplete" : "complete"}" />
      <div class="task-card__body">
        <div class="task-card__title">${escapeHtml(task.title)}</div>
        <div class="task-card__meta">
          <span class="task-card__priority task-card__priority--${task.priority}">${priority.label}</span>
          ${dueDateHtml}
          ${projectHtml}
          ${recurringHtml}
        </div>
        ${toolsHtml}
        ${notesHtml}
      </div>
      <div class="task-card__actions">
        <button class="ghost-button" data-edit="${task.id}">Edit</button>
        <button class="ghost-button" data-delete="${task.id}">Delete</button>
      </div>
    </article>
  `;
}

function render() {
  renderFilterBar();
  renderTaskList();
}

document.addEventListener("DOMContentLoaded", init);
