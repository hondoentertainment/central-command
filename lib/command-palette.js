/**
 * Global command palette (Cmd+K / Ctrl+K). Search tools and runbook notes.
 * Include on all pages; initializes automatically.
 */
import { loadStoredTools, STORAGE_KEYS, loadIntegrationsPreferences } from "./storage.js";
import {
  hydrateTools,
  createFallbackMetadataMap,
  sortTools,
  normalizeUrl,
} from "./tool-model.js";
import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "../data/presets.js";
import { getIconMarkup } from "./icons.js";
import { getCreativeHubConfig, openCreativeHub, trackIntegrationEvent } from "./integrations.js";
import { showToast } from "./toast.js";
import { getPluginCommands } from "./plugins.js";

const fallbackMetadata = createFallbackMetadataMap(ALL_PRESET_TOOLS);
const PAGE_ITEMS = [
  { key: "command", title: "Open Home", href: "index.html", keywords: "home dashboard tools deck" },
  { key: "registry", title: "Open Tools", href: "registry.html", keywords: "registry edit import export backups" },
  { key: "tasks", title: "Open Tasks", href: "tasks.html", keywords: "todo inbox today due task" },
  { key: "history", title: "Open Launch History", href: "history.html", keywords: "recent launches activity" },
  { key: "runbook", title: "Open Runbook", href: "runbook.html", keywords: "notes templates checklist" },
  { key: "profile", title: "Open Profile", href: "profile.html", keywords: "account security sync" },
  { key: "settings", title: "Open Settings", href: "settings.html", keywords: "theme appearance password" },
  { key: "agents", title: "Browse Agents", href: "agents.html", keywords: "ai tools" },
  { key: "packs", title: "Browse Starter Packs", href: "packs.html", keywords: "presets quick start" },
  { key: "productivity", title: "Browse Productivity", href: "productivity.html", keywords: "workflow focus" },
  { key: "writing", title: "Browse Writing", href: "writing.html", keywords: "drafting content" },
  { key: "sports", title: "Browse Sports", href: "sports.html", keywords: "espn scores" },
  { key: "games", title: "Browse Games", href: "games.html", keywords: "hsx play" },
  { key: "health", title: "Browse Health", href: "health.html", keywords: "wellness check" },
  { key: "music", title: "Browse Music", href: "music.html", keywords: "rolling stone spotify albums" },
  { key: "parties", title: "Browse Parties", href: "parties.html", keywords: "tuxedo party planner dreamer" },
  { key: "movies", title: "Browse Movies", href: "movies.html", keywords: "hsx letterboxd film" },
  { key: "admin", title: "Open Admin", href: "admin.html", keywords: "site management deploy" },
];

function loadTools() {
  return loadStoredTools(
    (value) => hydrateTools(value, fallbackMetadata),
    DEFAULT_TOOLS
  );
}

function loadRunbookNotes() {
  try {
    return localStorage.getItem(STORAGE_KEYS.notes) ?? "";
  } catch {
    return "";
  }
}

function loadTasks() {
  try {
    const raw = localStorage.getItem("central-command.tasks.v1");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadProjects() {
  try {
    const raw = localStorage.getItem("central-command.projects");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Filters tools by name, category, or description matching the query (case-insensitive).
 * @param {Array} tools - Tool objects with name, category, description
 * @param {string} query - Search string
 * @returns {Array} Tools that match the query
 */
export function searchTools(tools, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return tools.filter((tool) => {
    const haystack = `${tool.name} ${tool.category} ${tool.description}`.toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Finds lines in runbook notes that contain the query; returns up to 10 matches with snippet and line index.
 * @param {string} notes - Runbook notes text
 * @param {string} query - Search string
 * @returns {Array<{lineIndex: number, snippet: string, fullLine: string}>}
 */
export function searchRunbook(notes, query) {
  const q = query.trim().toLowerCase();
  if (!q || !notes) return [];
  const lines = notes.split("\n");
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes(q)) {
      const snippet = line.trim().slice(0, 80) + (line.trim().length > 80 ? "…" : "");
      matches.push({ lineIndex: i, snippet, fullLine: line });
    }
  }
  return matches.slice(0, 10);
}

/**
 * Filters tasks by title or notes matching the query (case-insensitive).
 * @param {Array} tasks - Task objects with title, notes, status, priority, dueDate, projectId
 * @param {string} query - Search string
 * @returns {Array} Up to 10 tasks that match the query
 */
export function searchTasks(tasks, query) {
  const q = query.trim().toLowerCase();
  if (!q || !Array.isArray(tasks)) return [];
  return tasks
    .filter((task) => {
      const haystack = `${task.title ?? ""} ${task.notes ?? ""}`.toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, 10);
}

/**
 * Searches across all projects' subtasks arrays, returning matches with parent project name.
 * @param {Array} projects - Project objects with name, id, subtasks[]
 * @param {string} query - Search string
 * @returns {Array<{projectName: string, subtaskTitle: string, projectId: string}>}
 */
export function searchProjectSubtasks(projects, query) {
  const q = query.trim().toLowerCase();
  if (!q || !Array.isArray(projects)) return [];
  const matches = [];
  for (const project of projects) {
    const subtasks = project.subtasks ?? [];
    for (const subtask of subtasks) {
      const title = subtask.title ?? subtask.name ?? "";
      if (title.toLowerCase().includes(q)) {
        matches.push({
          projectName: project.name ?? "",
          subtaskTitle: title,
          projectId: project.id ?? "",
        });
      }
    }
  }
  return matches.slice(0, 10);
}

/**
 * Returns nav pages that match the query (excluding current path). Empty query returns first 8 pages.
 * @param {string} query - Search string
 * @param {string} [currentPath] - Current page path to exclude (defaults to window location)
 * @returns {Array<{key: string, title: string, href: string, keywords: string}>}
 */
export function searchPages(query, currentPath = typeof window !== "undefined" ? window.location.pathname.split("/").pop() || "index.html" : "") {
  const q = query.trim().toLowerCase();
  const pages = PAGE_ITEMS.filter((page) => page.href !== currentPath);
  if (!q) return pages.slice(0, 8);
  return pages.filter((page) => `${page.title} ${page.keywords}`.toLowerCase().includes(q));
}

function createOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "command-palette-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Search tools and runbook");
  overlay.innerHTML = `
    <div class="command-palette-panel">
      <div class="command-palette-search">
        <span class="command-palette-icon" aria-hidden="true">⌘</span>
        <input type="search" class="command-palette-input" placeholder="Search tools, categories, runbook…" autocomplete="off" aria-label="Search tools and runbook" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="command-palette-listbox" aria-haspopup="listbox" />
      </div>
      <ul class="command-palette-results" role="listbox" id="command-palette-listbox" aria-label="Search results"></ul>
      <p class="command-palette-hint" aria-hidden="true">↑↓ Navigate · Enter Open · Esc Close</p>
    </div>
  `;
  return overlay;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function highlightMatch(text, query) {
  const q = query.trim();
  if (!q || !text) return escapeHtml(text);
  const re = new RegExp(`(${escapeRegex(q)})`, "gi");
  return escapeHtml(text).replace(re, "<mark>$1</mark>");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Initializes the global command palette (Ctrl+K / Cmd+K): search tools, runbook, and pages; opens overlay and binds keyboard handlers.
 * Safe to call multiple times; only initializes once.
 * @returns {void}
 */
export function initCommandPalette() {
  let overlay = null;
  let inputEl = null;
  let resultsEl = null;
  let selectedIndex = -1;
  let items = [];
  let previousActiveElement = null;

  function close() {
    if (!overlay) return;
    if (previousActiveElement && typeof previousActiveElement.focus === "function") {
      previousActiveElement.focus();
    }
    document.removeEventListener("keydown", handleKeydown);
    overlay.classList.add("is-closing");
    const ref = overlay;
    const cleanup = () => {
      ref.remove();
      document.body.style.overflow = "";
    };
    ref.addEventListener("animationend", cleanup, { once: true });
    // Fallback if animationend doesn't fire
    setTimeout(() => { if (ref.parentNode) cleanup(); }, 250);
    overlay = null;
  }

  function getFocusables() {
    if (!overlay) return [];
    const sel = 'input, button, [href], [tabindex]:not([tabindex="-1"])';
    return Array.from(overlay.querySelectorAll(sel));
  }

  function open() {
    if (overlay) return;
    previousActiveElement = document.activeElement;
    overlay = createOverlay();
    inputEl = overlay.querySelector(".command-palette-input");
    resultsEl = overlay.querySelector(".command-palette-results");

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    inputEl.focus();

    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const focusables = getFocusables();
      if (focusables.length < 2) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    document.addEventListener("keydown", handleKeydown);
    inputEl.addEventListener("input", debounce(renderResults, 150));
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        e.preventDefault();
      }
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    renderResults();
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      scrollToSelected();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      scrollToSelected();
      return;
    }
    if (e.key === "Enter" && items[selectedIndex]) {
      e.preventDefault();
      activateItem(items[selectedIndex]);
      return;
    }
  }

  function scrollToSelected() {
    updateSelectionDisplay();
    const li = resultsEl?.querySelector(`[data-index="${selectedIndex}"]`);
    li?.scrollIntoView({ block: "nearest" });
  }

  const OPTION_ID_PREFIX = "command-palette-option-";

  function updateSelectionDisplay() {
    resultsEl?.querySelectorAll(".command-palette-item").forEach((el, i) => {
      el.setAttribute("aria-selected", i === selectedIndex ? "true" : "false");
    });
    if (inputEl) {
      if (selectedIndex >= 0 && items[selectedIndex]) {
        const optionId = `${OPTION_ID_PREFIX}${selectedIndex}`;
        inputEl.setAttribute("aria-activedescendant", optionId);
      } else {
        inputEl.removeAttribute("aria-activedescendant");
      }
    }
  }

  function activateItem(item) {
    if (item.type === "tool") {
      const url = normalizeUrl(item.tool.url);
      if (item.tool.openMode === "same-tab") {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noreferrer");
      }
      close();
    } else if (item.type === "runbook") {
      window.location.href = "runbook.html";
      close();
    } else if (item.type === "page") {
      window.location.href = new URL(item.page.href, window.location.origin).href;
      close();
    } else if (item.type === "task") {
      window.location.href = "tasks.html";
      close();
    } else if (item.type === "subtask") {
      window.location.href = "projects.html";
      close();
    } else if (item.type === "integration") {
      openCreativeHub(item.integration, {
        source: "command-palette",
        trackEvent: trackIntegrationEvent,
        onError: (message) => showToast(message, "error"),
      });
      close();
    } else if (item.type === "plugin-command") {
      try {
        item.command.action();
      } catch (err) {
        console.warn("[CommandPalette] Plugin command error:", err);
      }
      close();
    }
  }

  function renderResults() {
    const query = inputEl?.value ?? "";
    const tools = sortTools(loadTools());
    const notes = loadRunbookNotes();
    const tasks = loadTasks();
    const projects = loadProjects();

    const toolMatches = searchTools(tools, query);
    const runbookMatches = searchRunbook(notes, query);
    const pageMatches = searchPages(query);
    const taskMatches = searchTasks(tasks, query);
    const subtaskMatches = searchProjectSubtasks(projects, query);
    const creativeHub = getCreativeHubConfig(loadIntegrationsPreferences());
    const queryText = query.trim().toLowerCase();
    const hasCreativeHubTool = tools.some((tool) => tool.name.toLowerCase() === "creative hub");
    const creativeHubSearchBlob = "creative hub integration open";
    const includeCreativeHub =
      creativeHub.enabled &&
      creativeHub.showInCommandPalette &&
      !hasCreativeHubTool &&
      (!queryText || creativeHubSearchBlob.includes(queryText));

    // Order: integrations → pages → tasks → tools → subtasks → runbook
    items = [];
    if (includeCreativeHub) {
      items.push({
        type: "integration",
        title: "Open Creative Hub",
        integration: creativeHub,
        meta: "Integration",
      });
    }
    pageMatches.forEach((page) => {
      items.push({ type: "page", page });
    });
    taskMatches.forEach((task) => {
      items.push({ type: "task", task });
    });
    toolMatches.forEach((tool) => {
      items.push({ type: "tool", tool });
    });
    subtaskMatches.forEach((subtask) => {
      items.push({ type: "subtask", subtask });
    });
    runbookMatches.forEach((r) => {
      items.push({ type: "runbook", snippet: r.snippet, lineIndex: r.lineIndex });
    });

    // Merge plugin-registered commands
    try {
      const pluginCmds = getPluginCommands();
      pluginCmds.forEach((cmd) => {
        const cmdSearchBlob = `${cmd.name} plugin ${cmd.pluginId}`.toLowerCase();
        if (!queryText || cmdSearchBlob.includes(queryText)) {
          items.push({ type: "plugin-command", command: cmd });
        }
      });
    } catch {
      // Plugin system may not be initialized yet
    }

    selectedIndex = items.length > 0 ? 0 : -1;

    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "command-palette-empty";
      empty.textContent = query.trim() ? "No matches" : "Type to search tools and runbook";
      resultsEl.appendChild(empty);
      if (inputEl) inputEl.removeAttribute("aria-activedescendant");
      return;
    }

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "command-palette-item";
      li.id = `${OPTION_ID_PREFIX}${index}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");
      li.setAttribute("data-index", String(index));

      if (item.type === "tool") {
        const icon = document.createElement("span");
        icon.className = "command-palette-item__icon";
        icon.innerHTML = getIconMarkup(item.tool);
        const name = document.createElement("span");
        name.className = "command-palette-item__name";
        name.innerHTML = highlightMatch(item.tool.name, query);
        const cat = document.createElement("span");
        cat.className = "command-palette-item__meta";
        cat.textContent = item.tool.category;
        li.append(icon, name, cat);
        li.addEventListener("click", () => activateItem(item));
      } else if (item.type === "integration") {
        const label = document.createElement("span");
        label.className = "command-palette-item__runbook-label";
        label.textContent = "Quick Action";
        const title = document.createElement("span");
        title.className = "command-palette-item__snippet";
        title.innerHTML = highlightMatch(item.title, query);
        li.append(label, title);
        li.addEventListener("click", () => activateItem(item));
      } else if (item.type === "page") {
        const label = document.createElement("span");
        label.className = "command-palette-item__runbook-label";
        label.textContent = "Page";
        const title = document.createElement("span");
        title.className = "command-palette-item__snippet";
        title.innerHTML = highlightMatch(item.page.title, query);
        li.append(label, title);
        li.addEventListener("click", () => activateItem(item));
      } else if (item.type === "task") {
        const label = document.createElement("span");
        label.className = "command-palette-item__runbook-label";
        label.textContent = "Task";
        const title = document.createElement("span");
        title.className = "command-palette-item__snippet";
        title.innerHTML = highlightMatch(item.task.title, query);
        if (item.task.priority) {
          const dot = document.createElement("span");
          dot.className = "command-palette-item__priority-dot";
          const colors = { high: "#e53e3e", medium: "#dd6b20", low: "#38a169" };
          dot.style.display = "inline-block";
          dot.style.width = "8px";
          dot.style.height = "8px";
          dot.style.borderRadius = "50%";
          dot.style.marginLeft = "6px";
          dot.style.backgroundColor = colors[item.task.priority] ?? "#718096";
          dot.title = item.task.priority;
          title.appendChild(dot);
        }
        const meta = document.createElement("span");
        meta.className = "command-palette-item__meta";
        meta.textContent = item.task.dueDate ? `Due ${item.task.dueDate}` : "";
        li.append(label, title, meta);
        li.addEventListener("click", () => activateItem(item));
      } else if (item.type === "subtask") {
        const label = document.createElement("span");
        label.className = "command-palette-item__runbook-label";
        label.textContent = "Subtask";
        const title = document.createElement("span");
        title.className = "command-palette-item__snippet";
        title.innerHTML = highlightMatch(item.subtask.subtaskTitle, query);
        const meta = document.createElement("span");
        meta.className = "command-palette-item__meta";
        meta.textContent = item.subtask.projectName;
        li.append(label, title, meta);
        li.addEventListener("click", () => activateItem(item));
      } else if (item.type === "plugin-command") {
        const label = document.createElement("span");
        label.className = "command-palette-item__runbook-label";
        label.textContent = "Plugin";
        const title = document.createElement("span");
        title.className = "command-palette-item__snippet";
        title.innerHTML = highlightMatch(item.command.name, query);
        li.append(label, title);
        li.addEventListener("click", () => activateItem(item));
      } else {
        const label = document.createElement("span");
        label.className = "command-palette-item__runbook-label";
        label.textContent = "Runbook";
        const snippet = document.createElement("span");
        snippet.className = "command-palette-item__snippet";
        snippet.innerHTML = highlightMatch(item.snippet, query);
        li.append(label, snippet);
        li.addEventListener("click", () => activateItem(item));
      }

      li.addEventListener("mouseenter", () => {
        selectedIndex = index;
        updateSelectionDisplay();
      });

      resultsEl.appendChild(li);
    });
    updateSelectionDisplay();
  }

  function debounce(fn, ms) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), ms);
    };
  }

  document.addEventListener("keydown", (e) => {
    const isCmdK = (e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === "k";
    if (!isCmdK) return;
    const active = document.activeElement;
    const isEditable =
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable);
    if (isEditable) return;
    e.preventDefault();
    open();
  });

  window.addEventListener("central-command:open-palette", open);
}
