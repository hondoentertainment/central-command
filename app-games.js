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
import { loadLaunchHistory, loadStoredTools, saveLaunchHistory } from "./lib/storage.js";
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
  gamesGrid: document.querySelector("#gamesGrid"),
};

initialize();

function initialize() {
  renderNav("games");
  renderGames();
}

function renderGames() {
  const gamesTools = sortTools(
    state.tools.filter((tool) => tool.category === "Games")
  );
  elements.gamesGrid.innerHTML = "";

  if (gamesTools.length === 0) {
    elements.gamesGrid.appendChild(
      createInlineEmptyState("Add tools with category Games (e.g. HSX) to see them here.")
    );
    return;
  }

  gamesTools.forEach((tool) => {
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
    elements.gamesGrid.appendChild(card);
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
    saveLaunchHistory(state.launchHistory);
  });
}

function createInlineEmptyState(message) {
  const note = document.createElement("p");
  note.className = "inline-empty-state";
  note.textContent = message;
  return note;
}
