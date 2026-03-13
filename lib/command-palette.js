/**
 * Global command palette (Cmd+K / Ctrl+K). Search tools and runbook notes.
 * Include on all pages; initializes automatically.
 */
import { loadStoredTools, loadNotes, STORAGE_KEYS, loadIntegrationsPreferences } from "./storage.js";
import {
  hydrateTools,
  createFallbackMetadataMap,
  sortTools,
  normalizeUrl,
} from "./tool-model.js";
import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "../data/presets.js";
import { getIconMarkup } from "./icons.js";
import { getCreativeHubConfig, openCreativeHub, trackIntegrationEvent } from "./integrations.js";

const fallbackMetadata = createFallbackMetadataMap(ALL_PRESET_TOOLS);

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

function searchTools(tools, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return tools.filter((tool) => {
    const haystack = `${tool.name} ${tool.category} ${tool.description}`.toLowerCase();
    return haystack.includes(q);
  });
}

function searchRunbook(notes, query) {
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
        <input type="search" class="command-palette-input" placeholder="Search tools, categories, runbook…" autocomplete="off" />
      </div>
      <ul class="command-palette-results" role="listbox"></ul>
      <p class="command-palette-hint">↑↓ Navigate · Enter Open · Esc Close</p>
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

export function initCommandPalette() {
  let overlay = null;
  let inputEl = null;
  let resultsEl = null;
  let selectedIndex = -1;
  let items = [];

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener("keydown", handleKeydown);
    document.body.style.overflow = "";
  }

  function open() {
    if (overlay) return;
    overlay = createOverlay();
    inputEl = overlay.querySelector(".command-palette-input");
    resultsEl = overlay.querySelector(".command-palette-results");

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    inputEl.focus();

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

  function updateSelectionDisplay() {
    resultsEl?.querySelectorAll(".command-palette-item").forEach((el, i) => {
      el.setAttribute("aria-selected", i === selectedIndex ? "true" : "false");
    });
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
    } else if (item.type === "integration") {
      openCreativeHub(item.integration, {
        source: "command-palette",
        trackEvent: trackIntegrationEvent,
      });
      close();
    }
  }

  function renderResults() {
    const query = inputEl?.value ?? "";
    const tools = sortTools(loadTools());
    const notes = loadRunbookNotes();

    const toolMatches = searchTools(tools, query);
    const runbookMatches = searchRunbook(notes, query);
    const creativeHub = getCreativeHubConfig(loadIntegrationsPreferences());
    const includeCreativeHub =
      creativeHub.enabled &&
      creativeHub.showInCommandPalette &&
      (query.trim() === "" || "creative hub".includes(query.trim().toLowerCase()));

    items = [];
    if (includeCreativeHub) {
      items.push({
        type: "integration",
        title: "Open Creative Hub",
        integration: creativeHub,
        meta: "Integration",
      });
    }
    toolMatches.forEach((tool) => {
      items.push({ type: "tool", tool });
    });
    runbookMatches.forEach((r) => {
      items.push({ type: "runbook", snippet: r.snippet, lineIndex: r.lineIndex });
    });

    selectedIndex = items.length > 0 ? 0 : -1;

    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "command-palette-empty";
      empty.textContent = query.trim() ? "No matches" : "Type to search tools and runbook";
      resultsEl.appendChild(empty);
      return;
    }

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "command-palette-item";
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
        resultsEl.querySelectorAll(".command-palette-item").forEach((el, i) => {
          el.setAttribute("aria-selected", i === selectedIndex ? "true" : "false");
        });
      });

      resultsEl.appendChild(li);
    });
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
}
