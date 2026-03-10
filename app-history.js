import { renderNav } from "./lib/nav.js";
import {
  createFallbackMetadataMap,
  filterHistoryForTools,
  formatLaunchTime,
  normalizePinRanks,
  normalizeUrl,
  recordLaunch,
  sanitizeLaunchHistory,
} from "./lib/tool-model.js";
import {
  loadLaunchHistory,
  loadStoredTools,
  saveLaunchHistory,
} from "./lib/storage.js";
import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "./data/presets.js";
import { hydrateTools } from "./lib/tool-model.js";

const fallbackMetadataBySignature = createFallbackMetadataMap(ALL_PRESET_TOOLS);

const tools = normalizePinRanks(
  loadStoredTools((value) => hydrateTools(value, fallbackMetadataBySignature), DEFAULT_TOOLS)
);

const state = {
  tools,
  launchHistory: filterHistoryForTools(loadLaunchHistory(sanitizeLaunchHistory), tools),
  historyFilter: "",
};

const elements = {
  launchHistoryList: document.querySelector("#launchHistoryList"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  historyFilterInput: document.querySelector("#historyFilterInput"),
  historyFilterActions: document.querySelector("#historyFilterActions"),
  clearFiltersButton: document.querySelector("#clearFiltersButton"),
};

initialize();

function initialize() {
  renderNav("history");
  elements.clearHistoryButton.addEventListener("click", clearLaunchHistory);
  elements.historyFilterInput.addEventListener("input", (event) => {
    state.historyFilter = event.target.value.trim().toLowerCase();
    renderLaunchHistory();
  });
  elements.clearFiltersButton.addEventListener("click", () => {
    state.historyFilter = "";
    elements.historyFilterInput.value = "";
    renderLaunchHistory();
  });
  renderLaunchHistory();
}

function renderLaunchHistory() {
  let historyEntries = filterHistoryForTools(state.launchHistory, state.tools);

  if (state.historyFilter) {
    const needle = state.historyFilter;
    historyEntries = historyEntries.filter((entry) => {
      const tool = state.tools.find((c) => c.id === entry.toolId);
      if (!tool) return false;
      const haystack = `${tool.name} ${tool.category}`.toLowerCase();
      return haystack.includes(needle);
    });
  }

  elements.historyFilterActions.hidden = !state.historyFilter;
  elements.launchHistoryList.innerHTML = "";
  elements.clearHistoryButton.disabled = state.launchHistory.length === 0;

  if (historyEntries.length === 0) {
    const item = document.createElement("li");
    item.className = "history-list__empty";
    item.textContent = state.historyFilter
      ? "No entries match that filter."
      : "Recent launches will appear here once you start using the deck.";
    elements.launchHistoryList.appendChild(item);
    return;
  }

  historyEntries.forEach((entry) => {
    const tool = state.tools.find((candidate) => candidate.id === entry.toolId);
    if (!tool) return;

    const item = document.createElement("li");
    item.className = "history-item";

    const link = document.createElement("a");
    link.className = "history-item__link";
    link.href = normalizeUrl(tool.url);
    link.setAttribute("aria-label", `Reopen ${tool.name}`);
    link.rel = "noreferrer";
    if (tool.openMode === "same-tab") {
      link.removeAttribute("target");
    } else {
      link.target = "_blank";
    }

    const title = document.createElement("strong");
    title.textContent = tool.name;

    const meta = document.createElement("span");
    meta.textContent = `${tool.category} · ${formatLaunchTime(entry.launchedAt)}`;

    link.append(title, meta);

    link.addEventListener("click", () => {
      state.launchHistory = recordLaunch(state.launchHistory, tool.id);
      saveLaunchHistory(state.launchHistory);
      if (tool.openMode === "new-tab") renderLaunchHistory();
    });

    const count = document.createElement("span");
    count.className = "history-item__count";
    count.textContent = `${entry.count}x`;

    item.append(link, count);
    elements.launchHistoryList.appendChild(item);
  });
}

function clearLaunchHistory() {
  if (state.launchHistory.length === 0) return;

  const confirmed = window.confirm("Clear recent launch history?");
  if (!confirmed) return;

  state.launchHistory = [];
  saveLaunchHistory(state.launchHistory);
  renderLaunchHistory();
}
