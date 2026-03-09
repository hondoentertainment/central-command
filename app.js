import { ALL_PRESET_TOOLS, CATEGORY_OPTIONS, DEFAULT_TOOLS } from "./data/presets.js";
import { getIconMarkup, ICON_OPTIONS } from "./lib/icons.js";
import { renderNav } from "./lib/nav.js";
import {
  createFallbackMetadataMap,
  filterHistoryForTools,
  formatLaunchTime,
  getNextPinRank,
  getToolSignature,
  hydrateTools,
  isValidLaunchTarget,
  movePinnedTool,
  normalizePinRanks,
  normalizeUrl,
  recordLaunch,
  sanitizeLaunchHistory,
  sanitizeTool,
  sortTools,
} from "./lib/tool-model.js";
import {
  hasSavedTools,
  loadLaunchHistory,
  loadStoredTools,
  saveLaunchHistory,
  saveStoredTools,
} from "./lib/storage.js";

const fallbackMetadataBySignature = createFallbackMetadataMap(ALL_PRESET_TOOLS);

const state = {
  tools: normalizePinRanks(
    loadStoredTools((value) => hydrateTools(value, fallbackMetadataBySignature), DEFAULT_TOOLS)
  ),
  activeCategory: "All",
  query: "",
  launchHistory: [],
};

state.launchHistory = filterHistoryForTools(
  loadLaunchHistory(sanitizeLaunchHistory),
  state.tools
);

const elements = {
  searchInput: document.querySelector("#searchInput"),
  toolGrid: document.querySelector("#toolGrid"),
  filterBar: document.querySelector("#filterBar"),
  pinnedCount: document.querySelector("#pinnedCount"),
  toolCount: document.querySelector("#toolCount"),
  recentLaunchCount: document.querySelector("#recentLaunchCount"),
  heroQuickLinks: document.querySelector("#heroQuickLinks"),
  spotlightGrid: document.querySelector("#spotlightGrid"),
  toolCardTemplate: document.querySelector("#toolCardTemplate"),
};

initialize();

function initialize() {
  renderNav("command");
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  render();
}

function render() {
  renderHeroQuickLinks();
  renderSpotlight();
  renderFilters();
  renderCards();
  updateStatusCards();
}

function renderHeroQuickLinks() {
  const quickLinks = sortTools(state.tools.filter((tool) => tool.surfaces.includes("hero")));
  elements.heroQuickLinks.innerHTML = "";

  if (quickLinks.length === 0) {
    elements.heroQuickLinks.appendChild(
      createInlineEmptyState("Pick a few tools to feature in the hero for one-click launch.")
    );
    return;
  }

  quickLinks.forEach((tool, index) => {
    const link = document.createElement("a");
    link.className = `hero__quick-link${index === 0 ? "" : " hero__quick-link--secondary"}`;
    link.setAttribute("aria-label", `Open ${tool.name}`);

    const icon = document.createElement("span");
    icon.className = "hero__quick-link-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = getIconMarkup(tool);

    const label = document.createElement("span");
    label.textContent = `Open ${tool.name}`;

    applyLaunchBehavior(link, tool);
    link.append(icon, label);
    elements.heroQuickLinks.appendChild(link);
  });
}

function renderSpotlight() {
  const spotlightTools = sortTools(
    state.tools.filter((tool) => tool.surfaces.includes("spotlight"))
  );
  elements.spotlightGrid.innerHTML = "";

  if (spotlightTools.length === 0) {
    elements.spotlightGrid.appendChild(
      createInlineEmptyState("Mark tools for spotlight to keep your core stack visible.")
    );
    return;
  }

  spotlightTools.forEach((tool) => {
    const card = document.createElement("a");
    card.className = "spotlight-card";
    card.setAttribute("aria-label", `Open ${tool.name}`);

    const icon = document.createElement("span");
    icon.className = "spotlight-card__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = getIconMarkup(tool);

    const title = document.createElement("strong");
    title.textContent = tool.name;

    const description = document.createElement("span");
    description.textContent = tool.description;

    applyLaunchBehavior(card, tool);
    card.append(icon, title, description);
    elements.spotlightGrid.appendChild(card);
  });
}

function renderFilters() {
  const categories = ["All", ...new Set(state.tools.map((tool) => tool.category).sort())];
  elements.filterBar.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${state.activeCategory === category ? " is-active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      state.activeCategory = category;
      renderCards();
      renderFilters();
    });
    elements.filterBar.appendChild(button);
  });
}

function getVisibleTools() {
  return sortTools(state.tools).filter((tool) => {
    const matchesCategory =
      state.activeCategory === "All" || tool.category === state.activeCategory;
    const haystack = `${tool.name} ${tool.category} ${tool.description}`.toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesCategory && matchesQuery;
  });
}

function renderCards() {
  const visibleTools = getVisibleTools();
  elements.toolGrid.innerHTML = "";

  if (visibleTools.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No tools match that filter yet. Add one or broaden the search.";
    elements.toolGrid.appendChild(emptyState);
    return;
  }

  const pinnedIds = sortTools(state.tools)
    .filter((tool) => tool.pinned)
    .map((tool) => tool.id);

  visibleTools.forEach((tool) => {
    const fragment = elements.toolCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".tool-card");
    const icon = fragment.querySelector(".tool-card__icon");
    const category = fragment.querySelector(".tool-card__category");
    const pin = fragment.querySelector(".tool-card__pin");
    const title = fragment.querySelector(".tool-card__title");
    const description = fragment.querySelector(".tool-card__description");
    const meta = fragment.querySelector(".tool-card__meta");
    const url = fragment.querySelector(".tool-card__url");
    const launchButton = fragment.querySelector(".launch-button");
    const moveUpButton = fragment.querySelector(".tool-card__move-up");
    const moveDownButton = fragment.querySelector(".tool-card__move-down");
    const editButton = fragment.querySelector(".tool-card__edit");
    const deleteButton = fragment.querySelector(".tool-card__delete");

    card.style.setProperty("--accent", accentToColor(tool.accent));
    icon.innerHTML = getIconMarkup(tool);
    category.textContent = tool.category;
    pin.hidden = !tool.pinned;
    title.textContent = tool.name;
    description.textContent = tool.description;
    url.textContent = tool.url;

    const metaBits = [];
    if (tool.shortcutLabel) metaBits.push({ label: `Shortcut ${tool.shortcutLabel}` });
    if (tool.openMode === "same-tab") metaBits.push({ label: "Same tab" });
    if (tool.surfaces.includes("hero")) metaBits.push({ label: "Hero" });
    if (tool.surfaces.includes("spotlight")) metaBits.push({ label: "Spotlight" });

    meta.innerHTML = "";
    if (metaBits.length === 0) {
      meta.hidden = true;
    } else {
      meta.hidden = false;
      metaBits.forEach((item) => {
        const badge = document.createElement("span");
        badge.className = "tool-card__badge";
        badge.textContent = item.label;
        meta.appendChild(badge);
      });
    }

    applyLaunchBehavior(launchButton, tool, `Launch ${tool.name}`);

    const pinnedIndex = pinnedIds.indexOf(tool.id);
    const isPinned = pinnedIndex >= 0;
    moveUpButton.hidden = !isPinned;
    moveDownButton.hidden = !isPinned;
    moveUpButton.disabled = !isPinned || pinnedIndex === 0;
    moveDownButton.disabled = !isPinned || pinnedIndex === pinnedIds.length - 1;
    moveUpButton.addEventListener("click", () => reorderPinnedTool(tool.id, "up"));
    moveDownButton.addEventListener("click", () => reorderPinnedTool(tool.id, "down"));

    editButton.addEventListener("click", () => {
      e.preventDefault();
      window.location.href = `registry.html?edit=${encodeURIComponent(tool.id)}`;
    });
    deleteButton.addEventListener("click", () => removeTool(tool.id));

    elements.toolGrid.appendChild(fragment);
  });
}

function reorderPinnedTool(id, direction) {
  state.tools = movePinnedTool(state.tools, id, direction);
  saveStoredTools(normalizePinRanks(state.tools));
  render();
}

function removeTool(id) {
  const tool = state.tools.find((entry) => entry.id === id);
  if (!tool) return;

  const confirmed = window.confirm(`Delete ${tool.name} from your command deck?`);
  if (!confirmed) return;

  state.tools = state.tools.filter((entry) => entry.id !== id);
  state.launchHistory = filterHistoryForTools(state.launchHistory, state.tools);
  saveStoredTools(state.tools);
  saveLaunchHistory(state.launchHistory);
  render();
  updateStatusCards();
}

function updateStatusCards() {
  elements.toolCount.textContent = String(state.tools.length);
  elements.pinnedCount.textContent = String(state.tools.filter((tool) => tool.pinned).length);
  const launchTotal = state.launchHistory.reduce((sum, entry) => sum + entry.count, 0);
  elements.recentLaunchCount.textContent = String(launchTotal);
}

function applyLaunchBehavior(element, tool, label = `Open ${tool.name}`) {
  element.href = normalizeUrl(tool.url);
  element.setAttribute("aria-label", label);

  if (tool.openMode === "same-tab") {
    element.removeAttribute("target");
    element.setAttribute("rel", "noreferrer");
  } else {
    element.target = "_blank";
    element.rel = "noreferrer";
  }

  element.addEventListener("click", () => {
    state.launchHistory = recordLaunch(state.launchHistory, tool.id);
    saveLaunchHistory(state.launchHistory);
    updateStatusCards();
  });
}

function createInlineEmptyState(message) {
  const note = document.createElement("p");
  note.className = "inline-empty-state";
  note.textContent = message;
  return note;
}

function accentToColor(accent) {
  return {
    amber: "var(--amber)",
    teal: "var(--teal)",
    crimson: "var(--crimson)",
    cobalt: "var(--cobalt)",
  }[accent] ?? "var(--amber)";
}
