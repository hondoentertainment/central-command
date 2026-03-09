import { ALL_PRESET_TOOLS, CATEGORY_OPTIONS, DEFAULT_TOOLS, PRESET_PACKS } from "./data/presets.js";
import { getIconMarkup, ICON_OPTIONS } from "./lib/icons.js";
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
  loadNotes,
  loadStoredTools,
  saveLaunchHistory,
  saveNotes,
  saveStoredTools,
} from "./lib/storage.js";

const EXPORT_VERSION = 2;
const fallbackMetadataBySignature = createFallbackMetadataMap(ALL_PRESET_TOOLS);

const state = {
  tools: normalizePinRanks(
    loadStoredTools((value) => hydrateTools(value, fallbackMetadataBySignature), DEFAULT_TOOLS)
  ),
  activeCategory: "All",
  query: "",
  launchHistory: [],
  isFirstVisit: !hasSavedTools(),
};

state.launchHistory = filterHistoryForTools(
  loadLaunchHistory(sanitizeLaunchHistory),
  state.tools
);

const elements = {
  toolForm: document.querySelector("#toolForm"),
  toolId: document.querySelector("#toolId"),
  name: document.querySelector("#name"),
  url: document.querySelector("#url"),
  categorySelect: document.querySelector("#categorySelect"),
  customCategoryWrap: document.querySelector("#customCategoryWrap"),
  customCategory: document.querySelector("#customCategory"),
  description: document.querySelector("#description"),
  accent: document.querySelector("#accent"),
  iconKey: document.querySelector("#iconKey"),
  shortcutLabel: document.querySelector("#shortcutLabel"),
  openMode: document.querySelector("#openMode"),
  pinned: document.querySelector("#pinned"),
  showInHero: document.querySelector("#showInHero"),
  showInSpotlight: document.querySelector("#showInSpotlight"),
  formMessage: document.querySelector("#formMessage"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  resetDefaultsButton: document.querySelector("#resetDefaultsButton"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importFileInput: document.querySelector("#importFileInput"),
  searchInput: document.querySelector("#searchInput"),
  toolGrid: document.querySelector("#toolGrid"),
  filterBar: document.querySelector("#filterBar"),
  notes: document.querySelector("#notes"),
  pinnedCount: document.querySelector("#pinnedCount"),
  toolCount: document.querySelector("#toolCount"),
  recentLaunchCount: document.querySelector("#recentLaunchCount"),
  heroQuickLinks: document.querySelector("#heroQuickLinks"),
  spotlightGrid: document.querySelector("#spotlightGrid"),
  toolCardTemplate: document.querySelector("#toolCardTemplate"),
  launchHistoryList: document.querySelector("#launchHistoryList"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  presetIntroEyebrow: document.querySelector("#presetIntroEyebrow"),
  presetIntroTitle: document.querySelector("#presetIntroTitle"),
  presetIntroText: document.querySelector("#presetIntroText"),
  presetGrid: document.querySelector("#presetGrid"),
  tabCommand: document.querySelector("#tabCommand"),
  tabRegistry: document.querySelector("#tabRegistry"),
  tabpanelCommand: document.querySelector("#tabpanel-command"),
  tabpanelRegistry: document.querySelector("#tabpanel-registry"),
};

initialize();

function switchTab(name) {
  const isCommand = name === "command";
  elements.tabCommand.classList.toggle("is-active", isCommand);
  elements.tabRegistry.classList.toggle("is-active", !isCommand);
  elements.tabCommand.setAttribute("aria-selected", isCommand);
  elements.tabRegistry.setAttribute("aria-selected", !isCommand);
  elements.tabpanelCommand.hidden = !isCommand;
  elements.tabpanelRegistry.hidden = isCommand;
}

function initialize() {
  elements.toolForm.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", () => resetForm());
  elements.resetDefaultsButton.addEventListener("click", () => applyPreset("full-command", true));
  elements.exportButton.addEventListener("click", exportBackup);
  elements.importButton.addEventListener("click", () => elements.importFileInput.click());
  elements.importFileInput.addEventListener("change", handleImport);
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });
  elements.categorySelect.addEventListener("change", syncCategoryVisibility);
  elements.notes.addEventListener("input", (event) => saveNotes(event.target.value));
  elements.clearHistoryButton.addEventListener("click", clearLaunchHistory);
  elements.tabCommand.addEventListener("click", () => switchTab("command"));
  elements.tabRegistry.addEventListener("click", () => switchTab("registry"));

  renderIconOptions();
  renderCategoryOptions();
  renderPresetCards();

  elements.notes.value = loadNotes();
  saveStoredTools(state.tools);
  saveLaunchHistory(state.launchHistory);

  resetForm();
  render();
}

function handleSubmit(event) {
  event.preventDefault();
  clearFormMessage();

  const existingTool = state.tools.find((entry) => entry.id === elements.toolId.value);
  const resolvedCategory = getResolvedCategory();
  const draft = sanitizeTool(
    {
      id: elements.toolId.value || crypto.randomUUID(),
      name: elements.name.value,
      url: elements.url.value,
      category: resolvedCategory,
      description: elements.description.value,
      accent: elements.accent.value,
      iconKey: elements.iconKey.value,
      shortcutLabel: elements.shortcutLabel.value,
      openMode: elements.openMode.value,
      pinned: elements.pinned.checked,
      pinRank: existingTool?.pinRank,
      surfaces: getSelectedSurfaces(),
    },
    existingTool
  );

  if (!draft) {
    setFormMessage("Fill out all required fields before saving the tool.", "error");
    return;
  }

  if (!isValidLaunchTarget(draft.url)) {
    setFormMessage("Use a valid URL, local path, network path, or app protocol.", "error");
    return;
  }

  const duplicate = state.tools.find(
    (tool) => tool.id !== draft.id && getToolSignature(tool) === getToolSignature(draft)
  );
  if (duplicate) {
    setFormMessage("That tool already exists in your command deck.", "error");
    return;
  }

  if (draft.pinned && !Number.isFinite(draft.pinRank)) {
    draft.pinRank = getNextPinRank(state.tools);
  }

  const existingIndex = state.tools.findIndex((entry) => entry.id === draft.id);
  if (existingIndex >= 0) {
    state.tools[existingIndex] = draft;
  } else {
    state.tools.unshift(draft);
  }

  state.isFirstVisit = false;
  commitTools();
  resetForm({ preserveMessage: true });
  setFormMessage(`${draft.name} saved.`, "success");
}

function beginEdit(id) {
  const tool = state.tools.find((entry) => entry.id === id);
  if (!tool) return;

  switchTab("registry");

  elements.toolId.value = tool.id;
  elements.name.value = tool.name;
  elements.url.value = tool.url;
  setCategoryValue(tool.category);
  elements.description.value = tool.description;
  elements.accent.value = tool.accent;
  elements.iconKey.value = tool.iconKey;
  elements.shortcutLabel.value = tool.shortcutLabel;
  elements.openMode.value = tool.openMode;
  elements.pinned.checked = tool.pinned;
  elements.showInHero.checked = tool.surfaces.includes("hero");
  elements.showInSpotlight.checked = tool.surfaces.includes("spotlight");
  elements.cancelEditButton.hidden = false;
  setFormMessage(`Editing ${tool.name}.`, "info");
  elements.name.focus();
}

function resetForm(options = {}) {
  const { preserveMessage = false } = options;

  elements.toolForm.reset();
  elements.toolId.value = "";
  elements.accent.value = "amber";
  elements.iconKey.value = "auto";
  elements.openMode.value = "new-tab";
  elements.pinned.checked = false;
  elements.showInHero.checked = false;
  elements.showInSpotlight.checked = false;
  elements.shortcutLabel.value = "";
  elements.customCategory.value = "";
  elements.categorySelect.value = "";
  syncCategoryVisibility();
  elements.cancelEditButton.hidden = true;

  if (!preserveMessage) clearFormMessage();
}

function getResolvedCategory() {
  if (elements.categorySelect.value === "custom") {
    return elements.customCategory.value;
  }

  return elements.categorySelect.value;
}

function getSelectedSurfaces() {
  return [
    elements.showInHero.checked ? "hero" : null,
    elements.showInSpotlight.checked ? "spotlight" : null,
  ].filter(Boolean);
}

function setCategoryValue(category) {
  renderCategoryOptions(category);

  const knownCategories = new Set([
    ...CATEGORY_OPTIONS,
    ...state.tools.map((tool) => tool.category),
  ]);

  if (knownCategories.has(category)) {
    elements.categorySelect.value = category;
    elements.customCategory.value = "";
  } else {
    elements.categorySelect.value = "custom";
    elements.customCategory.value = category;
  }

  syncCategoryVisibility();
}

function syncCategoryVisibility() {
  const isCustom = elements.categorySelect.value === "custom";
  elements.customCategoryWrap.hidden = !isCustom;
  elements.customCategory.toggleAttribute("required", isCustom);
}

function renderCategoryOptions(currentCategory = elements.categorySelect.value) {
  const categories = [
    ...new Set([...CATEGORY_OPTIONS, ...state.tools.map((tool) => tool.category)].filter(Boolean)),
  ].sort();

  elements.categorySelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a category";
  elements.categorySelect.appendChild(placeholder);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.categorySelect.appendChild(option);
  });

  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "Custom category";
  elements.categorySelect.appendChild(customOption);

  elements.categorySelect.value = currentCategory || "";
}

function renderIconOptions() {
  elements.iconKey.innerHTML = "";

  ICON_OPTIONS.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    elements.iconKey.appendChild(optionElement);
  });
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
  state.activeCategory = "All";
  state.query = "";
  state.isFirstVisit = false;
  elements.searchInput.value = "";
  commitTools();
  saveLaunchHistory(state.launchHistory);
  renderLaunchHistory();
  resetForm({ preserveMessage: true });
  setFormMessage(`${preset.title} applied. Notes were kept.`, "success");
}

function removeTool(id) {
  const tool = state.tools.find((entry) => entry.id === id);
  if (!tool) return;

  const confirmed = window.confirm(`Delete ${tool.name} from your command deck?`);
  if (!confirmed) return;

  state.tools = state.tools.filter((entry) => entry.id !== id);
  state.launchHistory = filterHistoryForTools(state.launchHistory, state.tools);
  commitTools();
  saveLaunchHistory(state.launchHistory);
  renderLaunchHistory();
  resetForm({ preserveMessage: true });
  setFormMessage(`${tool.name} removed.`, "success");
}

function reorderPinnedTool(id, direction) {
  state.tools = movePinnedTool(state.tools, id, direction);
  commitTools(false);
  setFormMessage("Pinned order updated.", "success");
}

function clearLaunchHistory() {
  if (state.launchHistory.length === 0) return;

  const confirmed = window.confirm("Clear recent launch history?");
  if (!confirmed) return;

  state.launchHistory = [];
  saveLaunchHistory(state.launchHistory);
  renderLaunchHistory();
  updateStatusCards();
}

function commitTools(keepMessage = true) {
  state.tools = normalizePinRanks(state.tools);
  saveStoredTools(state.tools);
  renderCategoryOptions(getResolvedCategory());
  render();

  if (!keepMessage) clearFormMessage();
}

function render() {
  renderPresetIntro();
  renderHeroQuickLinks();
  renderSpotlight();
  renderFilters();
  renderCards();
  renderLaunchHistory();
  updateStatusCards();
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
      renderLaunchHistory();
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

    editButton.addEventListener("click", () => beginEdit(tool.id));
    deleteButton.addEventListener("click", () => removeTool(tool.id));

    elements.toolGrid.appendChild(fragment);
  });
}

function renderLaunchHistory() {
  const historyEntries = filterHistoryForTools(state.launchHistory, state.tools);
  elements.launchHistoryList.innerHTML = "";
  elements.clearHistoryButton.disabled = historyEntries.length === 0;

  if (historyEntries.length === 0) {
    const item = document.createElement("li");
    item.className = "history-list__empty";
    item.textContent = "Recent launches will appear here once you start using the deck.";
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
    applyLaunchBehavior(link, tool, `Reopen ${tool.name}`);

    const title = document.createElement("strong");
    title.textContent = tool.name;

    const meta = document.createElement("span");
    meta.textContent = `${tool.category} · ${formatLaunchTime(entry.launchedAt)}`;

    link.append(title, meta);

    const count = document.createElement("span");
    count.className = "history-item__count";
    count.textContent = `${entry.count}x`;

    item.append(link, count);
    elements.launchHistoryList.appendChild(item);
  });
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
    renderLaunchHistory();
    updateStatusCards();
  });
}

function exportBackup() {
  const payload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tools: state.tools,
    notes: elements.notes.value,
    launchHistory: state.launchHistory,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  link.href = objectUrl;
  link.download = `central-command-backup-${stamp}.json`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  setFormMessage("Backup exported.", "success");
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const rawTools = Array.isArray(payload) ? payload : payload?.tools;
    const importedTools = hydrateTools(rawTools, fallbackMetadataBySignature);

    if (importedTools.length === 0) {
      throw new Error("No valid tools were found in that backup.");
    }

    state.tools = importedTools;
    state.launchHistory = filterHistoryForTools(
      sanitizeLaunchHistory(payload?.launchHistory),
      state.tools
    );
    state.activeCategory = "All";
    state.query = "";
    state.isFirstVisit = false;
    elements.searchInput.value = "";

    saveStoredTools(state.tools);
    saveLaunchHistory(state.launchHistory);

    if (typeof payload?.notes === "string") {
      elements.notes.value = payload.notes;
      saveNotes(payload.notes);
    }

    renderCategoryOptions();
    resetForm({ preserveMessage: true });
    render();
    setFormMessage(`Imported ${importedTools.length} tools from ${file.name}.`, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import that backup.";
    setFormMessage(message, "error");
  }
}

function createInlineEmptyState(message) {
  const note = document.createElement("p");
  note.className = "inline-empty-state";
  note.textContent = message;
  return note;
}

function setFormMessage(message, tone = "info") {
  elements.formMessage.textContent = message;
  elements.formMessage.className = `form-message is-${tone}`;
}

function clearFormMessage() {
  elements.formMessage.textContent = "";
  elements.formMessage.className = "form-message";
}

function accentToColor(accent) {
  return {
    amber: "var(--amber)",
    teal: "var(--teal)",
    crimson: "var(--crimson)",
    cobalt: "var(--cobalt)",
  }[accent] ?? "var(--amber)";
}
