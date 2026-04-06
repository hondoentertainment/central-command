import { fireLaunchHook } from "./hooks.js";
import { getIconMarkup } from "./icons.js";
import { renderNav } from "./nav.js";
import {
  createFallbackMetadataMap,
  filterHistoryForTools,
  hydrateTools,
  normalizePinRanks,
  normalizeUrl,
  recordLaunch,
  sanitizeLaunchHistory,
  sortTools,
} from "./tool-model.js";
import {
  loadLaunchHistory,
  loadLayoutPreference,
  loadStoredTools,
  saveLaunchHistorySynced,
} from "./storage.js";
import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "../data/presets.js";

/**
 * @typedef {Object} CategoryHubConfig
 * @property {string} navKey - Active nav key passed to `renderNav` (e.g. "sports").
 * @property {string} gridSelector - CSS selector for the spotlight grid container.
 * @property {string} category - Exact tool category label to filter.
 * @property {string} emptyStateMessage - Shown when no tools match the category.
 * @property {string} [emptyStateHint] - Optional actionable hint shown below the empty message.
 */

const fallbackMetadataBySignature = createFallbackMetadataMap(ALL_PRESET_TOOLS);

/**
 * Boot a category hub page: nav, layout preference, filtered tool grid, launch tracking.
 * @param {CategoryHubConfig} config
 */
export function initCategoryHubPage(config) {
  const { navKey, gridSelector, category, emptyStateMessage, emptyStateHint } = config;

  const tools = normalizePinRanks(
    loadStoredTools((value) => hydrateTools(value, fallbackMetadataBySignature), DEFAULT_TOOLS)
  );

  const state = {
    tools,
    launchHistory: filterHistoryForTools(loadLaunchHistory(sanitizeLaunchHistory), tools),
  };

  const grid = document.querySelector(gridSelector);
  if (!grid) {
    console.warn(`Category hub: missing grid element ${gridSelector}`);
    renderNav(navKey);
    return;
  }

  renderNav(navKey);
  applyLayoutToGrid(grid);
  renderCategoryGrid(grid, state, category, emptyStateMessage, emptyStateHint);
}

/**
 * @param {HTMLElement} grid
 */
function applyLayoutToGrid(grid) {
  const layout = loadLayoutPreference();
  grid.classList.remove("tool-grid--list", "tool-grid--compact");
  if (layout === "list") grid.classList.add("tool-grid--list");
  else if (layout === "compact") grid.classList.add("tool-grid--compact");
}

/**
 * @param {HTMLElement} grid
 * @param {{ tools: import("./tool-model.js").Tool[]; launchHistory: import("./tool-model.js").LaunchHistoryEntry[] }} state
 * @param {string} category
 * @param {string} emptyStateMessage
 */
function renderCategoryGrid(grid, state, category, emptyStateMessage, emptyStateHint) {
  const filtered = sortTools(state.tools.filter((tool) => tool.category === category));
  grid.innerHTML = "";

  if (filtered.length === 0) {
    const wrap = document.createElement("div");
    wrap.className = "category-empty-state";
    wrap.appendChild(createInlineEmptyState(emptyStateMessage));
    if (emptyStateHint) {
      const hint = document.createElement("p");
      hint.className = "category-empty-state__hint";
      hint.innerHTML = emptyStateHint;
      wrap.appendChild(hint);
    }
    grid.appendChild(wrap);
    return;
  }

  filtered.forEach((tool) => {
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

    applyLaunchBehavior(card, tool, state);
    card.append(icon, title, description);
    grid.appendChild(card);
  });
}

/**
 * @param {HTMLAnchorElement} element
 * @param {import("./tool-model.js").Tool} tool
 * @param {{ tools: import("./tool-model.js").Tool[]; launchHistory: import("./tool-model.js").LaunchHistoryEntry[] }} state
 * @param {string} [label]
 */
function applyLaunchBehavior(element, tool, state, label = `Open ${tool.name}`) {
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
    saveLaunchHistorySynced(state.launchHistory);
    const url = normalizeUrl(tool.url);
    fireLaunchHook({ toolId: tool.id, toolName: tool.name, url });
  });
}

function createInlineEmptyState(message) {
  const note = document.createElement("p");
  note.className = "inline-empty-state";
  note.textContent = message;
  return note;
}
