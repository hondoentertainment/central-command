import { ALL_PRESET_TOOLS, CATEGORY_OPTIONS, DEFAULT_TOOLS, PRESET_PACKS } from "./data/presets.js";
import { ICON_OPTIONS } from "./lib/icons.js";
import { requireAuth } from "./lib/auth.js";
import { renderNav } from "./lib/nav.js";
import {
  createFallbackMetadataMap,
  filterHistoryForTools,
  getNextPinRank,
  getToolSignature,
  hydrateTools,
  isValidLaunchTarget,
  normalizePinRanks,
  sanitizeLaunchHistory,
  sanitizeTool,
} from "./lib/tool-model.js";
import {
  loadLaunchHistory,
  loadNotes,
  loadStoredTools,
  saveLaunchHistory,
  saveNotes,
  saveStoredTools,
} from "./lib/storage.js";

const EXPORT_VERSION = 2;
const fallbackMetadataBySignature = createFallbackMetadataMap(ALL_PRESET_TOOLS);

const tools = normalizePinRanks(
  loadStoredTools((value) => hydrateTools(value, fallbackMetadataBySignature), DEFAULT_TOOLS)
);

const state = {
  tools,
  launchHistory: filterHistoryForTools(loadLaunchHistory(sanitizeLaunchHistory), tools),
};

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
};

requireAuth(initialize);

function initialize() {
  renderNav("registry");
  elements.toolForm.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", () => resetForm());
  elements.resetDefaultsButton.addEventListener("click", () => applyPreset("full-command", true));
  elements.exportButton.addEventListener("click", exportBackup);
  elements.importButton.addEventListener("click", () => elements.importFileInput.click());
  elements.importFileInput.addEventListener("change", handleImport);
  elements.categorySelect.addEventListener("change", syncCategoryVisibility);

  renderIconOptions();
  renderCategoryOptions();
  resetForm();
  loadEditFromUrl();
}

function loadEditFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit");
  if (editId) {
    const tool = state.tools.find((t) => t.id === editId);
    if (tool) beginEdit(tool);
  }
}

function beginEdit(tool) {
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

  commitTools();
  resetForm({ preserveMessage: true });
  setFormMessage(`${draft.name} saved.`, "success");
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
  commitTools();
  saveLaunchHistory(state.launchHistory);
  resetForm({ preserveMessage: true });
  setFormMessage(`${preset.title} applied. Notes were kept.`, "success");
  window.location.href = "index.html";
}

function commitTools() {
  state.tools = normalizePinRanks(state.tools);
  saveStoredTools(state.tools);
  renderCategoryOptions(getResolvedCategory());
}

function exportBackup() {
  const payload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tools: state.tools,
    notes: loadNotes(),
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

    saveStoredTools(state.tools);
    saveLaunchHistory(state.launchHistory);

    if (typeof payload?.notes === "string") {
      saveNotes(payload.notes);
    }

    renderCategoryOptions();
    resetForm({ preserveMessage: true });
    setFormMessage(`Imported ${importedTools.length} tools from ${file.name}.`, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import that backup.";
    setFormMessage(message, "error");
  }
}

function setFormMessage(message, tone = "info") {
  elements.formMessage.textContent = message;
  elements.formMessage.className = `form-message is-${tone}`;
}

function clearFormMessage() {
  elements.formMessage.textContent = "";
  elements.formMessage.className = "form-message";
}
