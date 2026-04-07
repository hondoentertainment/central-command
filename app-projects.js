import { renderNav } from "./lib/nav.js";
import { showToast } from "./lib/toast.js";
import { showConfirmDialog } from "./lib/confirm-dialog.js";
import { loadStoredTools } from "./lib/storage.js";
import { hydrateTools, createFallbackMetadataMap } from "./lib/tool-model.js";
import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "./data/presets.js";
import { getIconMarkup } from "./lib/icons.js";

const STORAGE_KEY = "central-command.projects";
const fallbackMetadata = createFallbackMetadataMap(ALL_PRESET_TOOLS);

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

const KNOWLEDGE_TYPES = {
  note:     { label: "Note",           icon: "\ud83d\udcdd" },
  decision: { label: "Decision",       icon: "\u2696\ufe0f" },
  link:     { label: "Link / Resource", icon: "\ud83d\udd17" },
  lesson:   { label: "Lesson Learned", icon: "\ud83d\udca1" },
};

let projects = [];
let activeFilter = "all";
let editingId = null;
let allTools = [];
let selectedToolIds = [];
let knowledgeProjectId = null;
let knowledgeFilter = "all";

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
  allTools = loadStoredTools(
    (value) => hydrateTools(value, fallbackMetadata),
    DEFAULT_TOOLS
  );

  document.getElementById("addProjectBtn")?.addEventListener("click", showForm);
  document.getElementById("projectCancelBtn")?.addEventListener("click", hideForm);
  document.getElementById("projectForm")?.addEventListener("submit", handleSubmit);
  document.getElementById("closeKnowledgeBtn")?.addEventListener("click", closeKnowledgeBase);
  document.getElementById("addKnowledgeBtn")?.addEventListener("click", toggleKnowledgeAddForm);
  document.getElementById("knowledgeEntrySubmit")?.addEventListener("click", submitKnowledgeEntry);
  document.getElementById("knowledgeEntryCancel")?.addEventListener("click", hideKnowledgeAddForm);
  initToolPicker();

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
    selectedToolIds = Array.isArray(project.toolIds) ? [...project.toolIds] : [];
    submitBtn.textContent = "Save";
  } else {
    editingId = null;
    document.getElementById("projectForm").reset();
    selectedToolIds = [];
    submitBtn.textContent = "Add";
  }
  renderSelectedTools();

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
    toolIds: [...selectedToolIds],
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
        ${renderProjectTools(project)}
        <div class="project-card__footer">
          <span class="project-card__date">${updatedLabel}</span>
          <div class="project-card__actions">
            ${linkHtml}
            <button class="ghost-button project-card__knowledge" data-knowledge="${project.id}">Knowledge</button>
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
  grid.querySelectorAll("[data-knowledge]").forEach(btn => {
    btn.addEventListener("click", () => openKnowledgeBase(btn.dataset.knowledge));
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

function renderProjectTools(project) {
  const tools = getToolsForProject(project);
  if (tools.length === 0) return "";
  const chips = tools.map(t =>
    `<a href="${escapeHtml(t.url)}" class="project-card__tool-chip" target="_blank" rel="noreferrer" title="${escapeHtml(t.name)}">
      <span class="project-card__tool-icon">${getIconMarkup(t)}</span>
      <span>${escapeHtml(t.name)}</span>
    </a>`
  ).join("");
  return `<div class="project-card__tools"><span class="project-card__tools-label">Tools</span>${chips}</div>`;
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

// --- Tool picker ---

function initToolPicker() {
  const searchInput = document.getElementById("projectToolsSearch");
  const dropdown = document.getElementById("projectToolsDropdown");
  if (!searchInput || !dropdown) return;

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      dropdown.hidden = true;
      return;
    }
    const matches = allTools
      .filter(t => !selectedToolIds.includes(t.id))
      .filter(t => `${t.name} ${t.category}`.toLowerCase().includes(query))
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="project-tools-picker__empty">No matching tools</div>';
      dropdown.hidden = false;
      return;
    }

    dropdown.innerHTML = matches.map(t => `
      <button type="button" class="project-tools-picker__option" data-tool-id="${t.id}">
        <span class="project-tools-picker__option-icon">${getIconMarkup(t)}</span>
        <span class="project-tools-picker__option-name">${escapeHtml(t.name)}</span>
        <span class="project-tools-picker__option-cat">${escapeHtml(t.category)}</span>
      </button>
    `).join("");
    dropdown.hidden = false;

    dropdown.querySelectorAll("[data-tool-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedToolIds.push(btn.dataset.toolId);
        searchInput.value = "";
        dropdown.hidden = true;
        renderSelectedTools();
      });
    });
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dropdown.hidden = true;
      searchInput.value = "";
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".project-tools-picker__search-wrap")) {
      dropdown.hidden = true;
    }
  });
}

function renderSelectedTools() {
  const container = document.getElementById("projectToolsSelected");
  if (!container) return;

  if (selectedToolIds.length === 0) {
    container.innerHTML = '<span class="project-tools-picker__hint">No tools linked yet</span>';
    return;
  }

  container.innerHTML = selectedToolIds.map(id => {
    const tool = allTools.find(t => t.id === id);
    if (!tool) return "";
    return `
      <span class="project-tool-chip">
        <span class="project-tool-chip__icon">${getIconMarkup(tool)}</span>
        <span>${escapeHtml(tool.name)}</span>
        <button type="button" class="project-tool-chip__remove" data-remove-id="${id}" aria-label="Remove ${escapeHtml(tool.name)}">&times;</button>
      </span>
    `;
  }).join("");

  container.querySelectorAll("[data-remove-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedToolIds = selectedToolIds.filter(id => id !== btn.dataset.removeId);
      renderSelectedTools();
    });
  });
}

function getToolsForProject(project) {
  if (!Array.isArray(project.toolIds) || project.toolIds.length === 0) return [];
  return project.toolIds
    .map(id => allTools.find(t => t.id === id))
    .filter(Boolean);
}

// --- Knowledge base ---

function openKnowledgeBase(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  knowledgeProjectId = projectId;
  knowledgeFilter = "all";

  document.querySelector(".panel--projects").hidden = true;
  const section = document.getElementById("knowledgeSection");
  section.hidden = false;
  document.getElementById("knowledgeProjectName").textContent = project.name;
  hideKnowledgeAddForm();
  renderKnowledgeFilterBar();
  renderKnowledgeEntries(project, knowledgeFilter);
}

function closeKnowledgeBase() {
  knowledgeProjectId = null;
  document.getElementById("knowledgeSection").hidden = true;
  document.querySelector(".panel--projects").hidden = false;
}

function renderKnowledgeFilterBar() {
  const bar = document.getElementById("knowledgeFilterBar");
  if (!bar) return;
  const types = [
    { key: "all", label: "All" },
    { key: "note", label: "Notes" },
    { key: "decision", label: "Decisions" },
    { key: "link", label: "Links" },
    { key: "lesson", label: "Lessons" },
  ];
  bar.innerHTML = types.map(t =>
    `<button class="filter-chip ${knowledgeFilter === t.key ? "is-active" : ""}" data-kfilter="${t.key}">${t.label}</button>`
  ).join("");

  bar.querySelectorAll("[data-kfilter]").forEach(btn => {
    btn.addEventListener("click", () => {
      knowledgeFilter = btn.dataset.kfilter;
      const project = projects.find(p => p.id === knowledgeProjectId);
      if (project) {
        renderKnowledgeFilterBar();
        renderKnowledgeEntries(project, knowledgeFilter);
      }
    });
  });
}

function renderKnowledgeEntries(project, filterType) {
  const container = document.getElementById("knowledgeEntries");
  const emptyEl = document.getElementById("knowledgeEmpty");
  if (!container) return;

  const log = Array.isArray(project.log) ? project.log : [];
  const entries = filterType === "all"
    ? log
    : log.filter(e => e.type === filterType);

  if (emptyEl) emptyEl.hidden = entries.length > 0;

  if (entries.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = entries.map(entry => {
    const typeConf = KNOWLEDGE_TYPES[entry.type] || KNOWLEDGE_TYPES.note;
    return `
      <div class="knowledge-entry">
        <span class="knowledge-entry__icon">${typeConf.icon}</span>
        <div class="knowledge-entry__body">
          <p class="knowledge-entry__text">${escapeHtml(entry.text)}</p>
          <div class="knowledge-entry__meta">
            <span class="knowledge-entry__type">${typeConf.label}</span>
            <span>${formatRelativeDate(entry.createdAt)}</span>
          </div>
        </div>
        <button class="knowledge-entry__delete" data-delete-entry="${entry.id}" title="Delete entry">&times;</button>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-delete-entry]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const confirmed = await showConfirmDialog({
        title: "Delete this entry?",
        message: "This knowledge base entry will be permanently removed.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (confirmed) {
        deleteKnowledgeEntry(knowledgeProjectId, btn.dataset.deleteEntry);
      }
    });
  });
}

function deleteKnowledgeEntry(projectId, entryId) {
  const project = projects.find(p => p.id === projectId);
  if (!project || !Array.isArray(project.log)) return;
  project.log = project.log.filter(e => e.id !== entryId);
  project.updatedAt = new Date().toISOString();
  saveProjects();
  showToast("Entry deleted");
  renderKnowledgeEntries(project, knowledgeFilter);
}

function toggleKnowledgeAddForm() {
  const form = document.getElementById("knowledgeAddForm");
  if (!form) return;
  form.hidden = !form.hidden;
  if (!form.hidden) {
    document.getElementById("knowledgeEntryText")?.focus();
  }
}

function hideKnowledgeAddForm() {
  const form = document.getElementById("knowledgeAddForm");
  if (form) {
    form.hidden = true;
    const textInput = document.getElementById("knowledgeEntryText");
    if (textInput) textInput.value = "";
    const typeSelect = document.getElementById("knowledgeEntryType");
    if (typeSelect) typeSelect.value = "note";
  }
}

function submitKnowledgeEntry() {
  const text = document.getElementById("knowledgeEntryText")?.value?.trim();
  const type = document.getElementById("knowledgeEntryType")?.value || "note";
  if (!text || !knowledgeProjectId) return;

  const project = projects.find(p => p.id === knowledgeProjectId);
  if (!project) return;

  if (!Array.isArray(project.log)) project.log = [];
  project.log.unshift({
    id: generateId(),
    text,
    type,
    createdAt: new Date().toISOString(),
  });
  project.updatedAt = new Date().toISOString();
  saveProjects();
  showToast("Entry added");
  hideKnowledgeAddForm();
  renderKnowledgeEntries(project, knowledgeFilter);
}

document.addEventListener("DOMContentLoaded", init);
