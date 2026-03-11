import { getIconMarkup } from "./lib/icons.js";
import { renderNav } from "./lib/nav.js";
import {
  createFallbackMetadataMap,
  filterHistoryForTools,
  hydrateTools,
  normalizePinRanks,
  normalizeUrl,
  recordLaunch,
  sanitizeLaunchHistory,
  sortTools,
} from "./lib/tool-model.js";
import {
  loadLaunchHistory,
  loadLayoutPreference,
  loadStoredTools,
  saveLaunchHistorySynced,
} from "./lib/storage.js";
import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "./data/presets.js";

const fallbackMetadataBySignature = createFallbackMetadataMap(ALL_PRESET_TOOLS);

const tools = normalizePinRanks(
  loadStoredTools((value) => hydrateTools(value, fallbackMetadataBySignature), DEFAULT_TOOLS)
);

const state = {
  tools,
  launchHistory: filterHistoryForTools(
    loadLaunchHistory(sanitizeLaunchHistory),
    tools
  ),
};

const elements = {
  productivityGrid: document.querySelector("#productivityGrid"),
};

initialize();

function initialize() {
  renderNav("productivity");
  applyLayoutToGrid();
  renderProductivity();
}

function applyLayoutToGrid() {
  const grid = elements.productivityGrid;
  if (!grid) return;
  const layout = loadLayoutPreference();
  grid.classList.remove("tool-grid--list", "tool-grid--compact");
  if (layout === "list") grid.classList.add("tool-grid--list");
  else if (layout === "compact") grid.classList.add("tool-grid--compact");
}

function renderProductivity() {
  const productivityTools = sortTools(
    state.tools.filter((tool) => tool.category === "Productivity")
  );
  elements.productivityGrid.innerHTML = "";

  if (productivityTools.length === 0) {
    elements.productivityGrid.appendChild(
      createInlineEmptyState("Add tools with category Productivity (e.g. Evernote, task managers) to see them here.")
    );
    return;
  }

  productivityTools.forEach((tool) => {
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
    elements.productivityGrid.appendChild(card);
  });
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
    saveLaunchHistorySynced(state.launchHistory);
  });
}

function createInlineEmptyState(message) {
  const note = document.createElement("p");
  note.className = "inline-empty-state";
  note.textContent = message;
  return note;
}
