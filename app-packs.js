import { PRESET_PACKS } from "./data/presets.js";
import { renderNav } from "./lib/nav.js";
import {
  hydrateTools,
  normalizePinRanks,
  sanitizeLaunchHistory,
} from "./lib/tool-model.js";
import {
  hasSavedTools,
  loadLaunchHistory,
  loadStoredTools,
  saveLaunchHistorySynced,
  saveStoredToolsSynced,
} from "./lib/storage.js";
import { createFallbackMetadataMap, filterHistoryForTools } from "./lib/tool-model.js";
import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "./data/presets.js";

const fallbackMetadataBySignature = createFallbackMetadataMap(ALL_PRESET_TOOLS);

const state = {
  tools: normalizePinRanks(
    loadStoredTools((value) => hydrateTools(value, fallbackMetadataBySignature), DEFAULT_TOOLS)
  ),
  launchHistory: filterHistoryForTools(
    loadLaunchHistory(sanitizeLaunchHistory),
    loadStoredTools((v) => hydrateTools(v, fallbackMetadataBySignature), DEFAULT_TOOLS)
  ),
  isFirstVisit: !hasSavedTools(),
};

const elements = {
  presetIntroEyebrow: document.querySelector("#presetIntroEyebrow"),
  presetIntroTitle: document.querySelector("#presetIntroTitle"),
  presetIntroText: document.querySelector("#presetIntroText"),
  presetGrid: document.querySelector("#presetGrid"),
};

initialize();

function initialize() {
  renderNav("packs");
  renderPresetIntro();
  renderPresetCards();
}

function renderPresetIntro() {
  elements.presetIntroEyebrow.textContent = state.isFirstVisit ? "Quick Start" : "Starter Packs";
  elements.presetIntroTitle.textContent = state.isFirstVisit
    ? "Choose a setup and start fast"
    : "Swap in a curated starting deck";
  elements.presetIntroText.textContent = state.isFirstVisit
    ? "Start with a preset, then tune the deck to match your day-to-day workflow."
    : "Use these presets when you want to reset the deck around a specific kind of work.";
}

function renderPresetCards() {
  elements.presetGrid.innerHTML = "";

  PRESET_PACKS.forEach((pack) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-card";
    button.addEventListener("click", () => applyPreset(pack.id));

    const title = document.createElement("strong");
    title.textContent = pack.title;

    const description = document.createElement("span");
    description.textContent = pack.description;

    const meta = document.createElement("span");
    meta.className = "preset-card__meta";
    meta.textContent = `${pack.tools.length} tools`;

    button.append(title, description, meta);
    elements.presetGrid.appendChild(button);
  });
}

function applyPreset(presetId, isRestore = false) {
  const preset = PRESET_PACKS.find((entry) => entry.id === presetId);
  if (!preset) return;

  const message = isRestore
    ? "Restore the full starter deck and replace your current tools?"
    : `Replace your current tools with the ${preset.title} preset?`;
  const confirmed = window.confirm(message);
  if (!confirmed) return;

  state.tools = normalizePinRanks(structuredClone(preset.tools));
  state.launchHistory = [];
  state.isFirstVisit = false;

  saveStoredToolsSynced(state.tools);
  saveLaunchHistorySynced(state.launchHistory);

  window.location.href = "index.html";
}
