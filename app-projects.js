import { renderNav } from "./lib/nav.js";
import { showToast } from "./lib/toast.js";
import { showConfirmDialog } from "./lib/confirm-dialog.js";

const STORAGE_KEY = "central-command.projects";

const STATUS_CONFIG = {
  "idea":        { label: "Idea",        color: "#8f8b82", icon: "💡" },
  "planning":    { label: "Planning",    color: "#5b7fdb", icon: "📋" },
  "in-progress": { label: "In Progress", color: "#e8a43a", icon: "🔨" },
  "review":      { label: "Review",      color: "#a78bfa", icon: "🔍" },
  "done":        { label: "Done",        color: "#3eb4a5", icon: "✅" },
  "on-hold":     { label: "On Hold",     color: "#e85a6b", icon: "⏸️" },
};

const PRIORITY_CONFIG = {
  "low":      { label: "Low",      color: "#8f8b82" },
  "medium":   { label: "Medium",   color: "#e8a43a" },
  "high":     { label: "High",     color: "#e85a6b" },
  "critical": { label: "Critical", color: "#ff4d6a" },
};

let projects = [];
let activeFilter = "all";
let editingId = null;

function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveProjects() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function init() {
  renderNav("projects");
  projects = loadProjects();

  document.getElementById("addProjectBtn")?.addEventListener("click", showForm);
  document.getElementById("projectCancelBtn")?.addEventListener("click", hideForm);
  document.getElementById("projectForm")?.addEventListener("submit", handleSubmit);

  render();
}

function showForm(project = null) {
  const wrap = document.getElementById("projectFormWrap");
  const submitBtn = document.getElementById("projectSubmitBtn");
  if (!wrap) return;

  if (project && typeof project === "object" && project.id) {
    editingId = project.id;
    document.getElementById("projectName").value = project.name || "";
    document.getElementById("projectDescription").value = project.description || "";
    document.getElementById("projectStatus").value = project.status || "idea";
    document.getElementById("projectPriority").value = project.priority || "medium";
    document.getElementById("projectUrl").value = project.url || "";
    document.getElementById("projectTags").value = (project.tags || []).join(", ");
    submitBtn.textContent = "Save";
  } else {
    editingId = null;
    document.getElementById("projectForm").reset();
    submitBtn.textContent = "Add";
  }

  wrap.hidden = false;
  requestAnimationFrame(() => document.getElementById("projectName")?.focus());
}

function hideForm() {
  const wrap = document.getElementById("projectFormWrap");
  if (wrap) wrap.hidden = true;
  editingId = null;
}

function handleSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("projectName")?.value?.trim();
  if (!name) return;

  const data = {
    name,
    description: document.getElementById("projectDescription")?.value?.trim() || "",
    status: document.getElementById("projectStatus")?.value || "idea",
    priority: document.getElementById("projectPriority")?.value || "medium",
    url: document.getElementById("projectUrl")?.value?.trim() || "",
    tags: (document.getElementById("projectTags")?.value || "")
      .split(",").map(t => t.trim()).filter(Boolean),
  };

  if (editingId) {
    const idx = projects.findIndex(p => p.id === editingId);
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], ...data, updatedAt: new Date().toISOString() };
      showToast("Project updated");
    }
  } else {
    projects.unshift({
      id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    showToast("Project added");
  }

  saveProjects();
  hideForm();
  render();
}

function deleteProject(id) {
  projects = projects.filter(p => p.id !== id);
  saveProjects();
  showToast("Project deleted");
  render();
}

function cycleStatus(id) {
  const order = ["idea", "planning", "in-progress", "review", "done", "on-hold"];
  const proj = projects.find(p => p.id === id);
  if (!proj) return;
  const idx = order.indexOf(proj.status);
  proj.status = order[(idx + 1) % order.length];
  proj.updatedAt = new Date().toISOString();
  saveProjects();
  render();
}

function getFilteredProjects() {
  if (activeFilter === "all") return projects;
  return projects.filter(p => p.status === activeFilter);
}

function renderStats() {
  const el = document.getElementById("projectStats");
  if (!el) return;
  const counts = { total: projects.length };
  for (const key of Object.keys(STATUS_CONFIG)) {
    counts[key] = projects.filter(p => p.status === key).length;
  }

  el.innerHTML = `
    <button class="project-stat-chip ${activeFilter === "all" ? "project-stat-chip--active" : ""}" data-filter="all">
      <span class="project-stat-chip__count">${counts.total}</span> All
    </button>
    ${Object.entries(STATUS_CONFIG).map(([key, cfg]) => `
      <button class="project-stat-chip ${activeFilter === key ? "project-stat-chip--active" : ""}" data-filter="${key}" style="--chip-color: ${cfg.color}">
        <span class="project-stat-chip__count">${counts[key] || 0}</span> ${cfg.label}
      </button>
    `).join("")}
  `;

  el.querySelectorAll(".project-stat-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      render();
    });
  });
}

function renderProjects() {
  const grid = document.getElementById("projectGrid");
  const empty = document.getElementById("projectEmpty");
  if (!grid) return;

  const filtered = getFilteredProjects();
  if (empty) empty.hidden = filtered.length > 0;

  grid.innerHTML = filtered.map(project => {
    const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.idea;
    const priority = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.medium;
    const tagsHtml = (project.tags || []).map(t =>
      `<span class="project-card__tag">${escapeHtml(t)}</span>`
    ).join("");
    const linkHtml = project.url
      ? `<a href="${escapeHtml(project.url)}" class="project-card__link" target="_blank" rel="noreferrer">Open →</a>`
      : "";
    const updatedLabel = project.updatedAt ? formatRelativeDate(project.updatedAt) : "";

    return `
      <article class="project-card" style="--status-color: ${status.color}">
        <div class="project-card__header">
          <button class="project-card__status-badge" data-cycle="${project.id}" title="Click to cycle status">
            <span class="project-card__status-icon">${status.icon}</span>
            ${status.label}
          </button>
          <span class="project-card__priority" style="color: ${priority.color}">${priority.label}</span>
        </div>
        <h3 class="project-card__title">${escapeHtml(project.name)}</h3>
        ${project.description ? `<p class="project-card__desc">${escapeHtml(project.description)}</p>` : ""}
        ${tagsHtml ? `<div class="project-card__tags">${tagsHtml}</div>` : ""}
        <div class="project-card__footer">
          <span class="project-card__date">${updatedLabel}</span>
          <div class="project-card__actions">
            ${linkHtml}
            <button class="ghost-button project-card__edit" data-edit="${project.id}">Edit</button>
            <button class="ghost-button project-card__delete" data-delete="${project.id}">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-cycle]").forEach(btn => {
    btn.addEventListener("click", () => cycleStatus(btn.dataset.cycle));
  });
  grid.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const proj = projects.find(p => p.id === btn.dataset.edit);
      if (proj) showForm(proj);
    });
  });
  grid.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const confirmed = await showConfirmDialog({
        title: "Delete this project?",
        message: "This project will be permanently removed.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (confirmed) deleteProject(btn.dataset.delete);
    });
  });
}

function render() {
  renderStats();
  renderProjects();
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function formatRelativeDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

document.addEventListener("DOMContentLoaded", init);
