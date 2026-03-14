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
  loadCustomCategories,
  loadLayoutPreference,
  loadLaunchHistorySynced,
  loadStoredToolsSynced,
  loadSurfacesPreferences,
  performInitialSync,
  saveLayoutPreference,
  saveLaunchHistorySynced,
  saveStoredToolsSynced,
  saveSurfacesPreferences,
  loadIntegrationsPreferences,
  saveIntegrationsPreferences,
} from "./lib/storage.js";
import {
  buildCreativeHubTool,
  getCreativeHubConfig,
  sanitizeIntegrationsPreferences,
  validateIntegrationUrl,
} from "./lib/integrations.js";
import { showToast } from "./lib/toast.js";

const fallbackMetadataBySignature = createFallbackMetadataMap(ALL_PRESET_TOOLS);

const state = {
  tools: [],
  activeCategory: "All",
  query: "",
  launchHistory: [],
  selectMode: false,
  selectedToolIds: new Set(),
};

const elements = {
  searchInput: document.querySelector("#searchInput"),
  toolGrid: document.querySelector("#toolGrid"),
  layoutToggle: document.querySelector("#layoutToggle"),
  filterBar: document.querySelector("#filterBar"),
  pinnedCount: document.querySelector("#pinnedCount"),
  toolCount: document.querySelector("#toolCount"),
  recentLaunchCount: document.querySelector("#recentLaunchCount"),
  heroQuickLinks: document.querySelector("#heroQuickLinks"),
  spotlightGrid: document.querySelector("#spotlightGrid"),
  toolCardTemplate: document.querySelector("#toolCardTemplate"),
  addToolBtn: document.querySelector("#addToolBtn"),
  selectModeBtn: document.querySelector("#selectModeBtn"),
  batchActionBar: document.querySelector("#batchActionBar"),
  batchSelectedCount: document.querySelector("#batchSelectedCount"),
  batchPinBtn: document.querySelector("#batchPinBtn"),
  batchDeleteBtn: document.querySelector("#batchDeleteBtn"),
  batchCategorySelect: document.querySelector("#batchCategorySelect"),
  batchDoneBtn: document.querySelector("#batchDoneBtn"),
  quickAddFormWrap: document.querySelector("#quickAddFormWrap"),
  quickAddForm: document.querySelector("#quickAddForm"),
  quickAddName: document.querySelector("#quickAddName"),
  quickAddUrl: document.querySelector("#quickAddUrl"),
  quickAddCategory: document.querySelector("#quickAddCategory"),
  quickAddCancel: document.querySelector("#quickAddCancel"),
  heroSection: document.querySelector("#heroSection"),
  spotlightSection: document.querySelector("#spotlightSection"),
  surfacesSettingsBtn: document.querySelector("#surfacesSettingsBtn"),
  surfacesSettingsPanel: document.querySelector("#surfacesSettingsPanel"),
  surfacesShowHero: document.querySelector("#surfacesShowHero"),
  surfacesShowSpotlight: document.querySelector("#surfacesShowSpotlight"),
  creativeHubEnabled: document.querySelector("#creativeHubEnabled"),
  creativeHubShowInNav: document.querySelector("#creativeHubShowInNav"),
  creativeHubShowInPalette: document.querySelector("#creativeHubShowInPalette"),
  creativeHubShowAsTool: document.querySelector("#creativeHubShowAsTool"),
  creativeHubUrl: document.querySelector("#creativeHubUrl"),
  creativeHubOpenMode: document.querySelector("#creativeHubOpenMode"),
};

initialize();

async function initialize() {
  const tools = await loadStoredToolsSynced(
    (value) => hydrateTools(value, fallbackMetadataBySignature),
    DEFAULT_TOOLS
  );
  state.tools = normalizePinRanks(tools);

  const history = await loadLaunchHistorySynced(sanitizeLaunchHistory);
  state.launchHistory = filterHistoryForTools(history, state.tools);

  renderNav("command", {
    onAuthChange: async (user) => {
      if (user) {
        await performInitialSync({
          hydrateTools: (v) => hydrateTools(v, fallbackMetadataBySignature),
          fallbackTools: DEFAULT_TOOLS,
          sanitizeLaunchHistory,
          onSynced: (data) => {
            state.tools = normalizePinRanks(data.tools);
            state.launchHistory = filterHistoryForTools(data.history, state.tools);
            render();
          },
        });
      }
    },
  });
  applyLayoutClass(loadLayoutPreference());
  setupLayoutToggle();
  applySurfacesVisibility("command");
  setupSurfacesSettings();
  setupIntegrationSettings();
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  elements.addToolBtn?.addEventListener("click", showQuickAddForm);
  elements.quickAddForm?.addEventListener("submit", handleQuickAddSubmit);
  elements.quickAddCancel?.addEventListener("click", hideQuickAddForm);

  elements.selectModeBtn?.addEventListener("click", toggleSelectMode);
  elements.batchPinBtn?.addEventListener("click", batchPinSelected);
  elements.batchDeleteBtn?.addEventListener("click", batchDeleteSelected);
  elements.batchCategorySelect?.addEventListener("change", batchChangeCategory);
  elements.batchDoneBtn?.addEventListener("click", exitSelectMode);

  document.addEventListener("keydown", handleKeyboardShortcut);
  document.addEventListener("keydown", handleToolGridKeydown);
  render();
}

function applyLayoutClass(layout) {
  if (!elements.toolGrid) return;
  elements.toolGrid.classList.remove("tool-grid--list", "tool-grid--compact");
  if (layout === "list") elements.toolGrid.classList.add("tool-grid--list");
  else if (layout === "compact") elements.toolGrid.classList.add("tool-grid--compact");
}

function setupLayoutToggle() {
  const layoutToggle = document.querySelector("#layoutToggle");
  if (!layoutToggle) return;
  const layout = loadLayoutPreference();
  layoutToggle.querySelectorAll(".layout-toggle__btn").forEach((btn) => {
    const l = btn.dataset.layout;
    btn.setAttribute("aria-pressed", l === layout ? "true" : "false");
    btn.addEventListener("click", () => {
      saveLayoutPreference(l);
      applyLayoutClass(l);
      layoutToggle.querySelectorAll(".layout-toggle__btn").forEach((b) =>
        b.setAttribute("aria-pressed", b.dataset.layout === l ? "true" : "false")
      );
    });
  });
}

const DEFAULT_SURFACES = { command: ["hero", "spotlight"] };

function getSurfacesForPage(pageKey) {
  const prefs = loadSurfacesPreferences();
  const surfaces = prefs?.[pageKey];
  if (Array.isArray(surfaces)) return surfaces;
  return DEFAULT_SURFACES[pageKey] ?? ["hero", "spotlight"];
}

function applySurfacesVisibility(pageKey) {
  const surfaces = getSurfacesForPage(pageKey);
  if (elements.heroSection) elements.heroSection.hidden = !surfaces.includes("hero");
  if (elements.spotlightSection) elements.spotlightSection.hidden = !surfaces.includes("spotlight");
}

function setupSurfacesSettings() {
  const prefs = loadSurfacesPreferences();
  const surfaces = prefs?.command ?? DEFAULT_SURFACES.command;
  if (elements.surfacesShowHero) elements.surfacesShowHero.checked = surfaces.includes("hero");
  if (elements.surfacesShowSpotlight) elements.surfacesShowSpotlight.checked = surfaces.includes("spotlight");

  elements.surfacesSettingsBtn?.addEventListener("click", () => {
    const panel = elements.surfacesSettingsPanel;
    if (!panel) return;
    panel.hidden = !panel.hidden;
    elements.surfacesSettingsBtn?.setAttribute("aria-expanded", String(!panel.hidden));
  });

  const updateFromCheckboxes = () => {
    const showHero = elements.surfacesShowHero?.checked ?? true;
    const showSpotlight = elements.surfacesShowSpotlight?.checked ?? true;
    const surfaces = [];
    if (showHero) surfaces.push("hero");
    if (showSpotlight) surfaces.push("spotlight");
    const prefs = loadSurfacesPreferences() ?? {};
    prefs.command = surfaces;
    saveSurfacesPreferences(prefs);
    applySurfacesVisibility("command");
  };

  elements.surfacesShowHero?.addEventListener("change", updateFromCheckboxes);
  elements.surfacesShowSpotlight?.addEventListener("change", updateFromCheckboxes);
}


function getIntegrationPrefs() {
  return sanitizeIntegrationsPreferences(loadIntegrationsPreferences());
}

function getToolsWithIntegrationEntries() {
  const prefs = getIntegrationPrefs();
  const creativeHubTool = buildCreativeHubTool(getCreativeHubConfig(prefs));
  if (!creativeHubTool) return state.tools;
  const hasCreativeHub = state.tools.some((tool) => tool.name.toLowerCase() === "creative hub");
  if (hasCreativeHub) return state.tools;
  return [...state.tools, sanitizeTool(creativeHubTool)].filter(Boolean);
}

function setupIntegrationSettings() {
  const prefs = getIntegrationPrefs();
  const creativeHub = prefs.creativeHub;

  if (elements.creativeHubEnabled) elements.creativeHubEnabled.checked = creativeHub.enabled;
  if (elements.creativeHubShowInNav) elements.creativeHubShowInNav.checked = creativeHub.showInNav;
  if (elements.creativeHubShowInPalette) elements.creativeHubShowInPalette.checked = creativeHub.showInCommandPalette;
  if (elements.creativeHubShowAsTool) elements.creativeHubShowAsTool.checked = creativeHub.showAsTool;
  if (elements.creativeHubUrl) elements.creativeHubUrl.value = creativeHub.url;
  if (elements.creativeHubOpenMode) elements.creativeHubOpenMode.value = creativeHub.openMode;

  const savePrefs = () => {
    const urlValidation = validateIntegrationUrl(elements.creativeHubUrl?.value);
    if (!urlValidation.isValid) {
      showToast("Creative Hub URL is invalid. Using default URL.", "error");
    }

    const next = sanitizeIntegrationsPreferences({
      creativeHub: {
        enabled: elements.creativeHubEnabled?.checked ?? true,
        showInNav: elements.creativeHubShowInNav?.checked ?? true,
        showInCommandPalette: elements.creativeHubShowInPalette?.checked ?? true,
        showAsTool: elements.creativeHubShowAsTool?.checked ?? true,
        url: urlValidation.url,
        openMode: elements.creativeHubOpenMode?.value,
      },
    });

    if (elements.creativeHubUrl) {
      elements.creativeHubUrl.value = next.creativeHub.url;
    }

    saveIntegrationsPreferences(next);
    renderNav("command");
    render();
  };

  [
    elements.creativeHubEnabled,
    elements.creativeHubShowInNav,
    elements.creativeHubShowInPalette,
    elements.creativeHubShowAsTool,
    elements.creativeHubOpenMode,
  ].forEach((el) => el?.addEventListener("change", savePrefs));

  elements.creativeHubUrl?.addEventListener("blur", savePrefs);
}

function showQuickAddForm() {
  const wrap = elements.quickAddFormWrap;
  const select = elements.quickAddCategory;
  if (!wrap || !select) return;

  select.innerHTML = "";
  const customCats = loadCustomCategories();
  const categories = [...new Set([...CATEGORY_OPTIONS, ...customCats, ...state.tools.map((t) => t.category)].sort())];
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  elements.quickAddName.value = "";
  elements.quickAddUrl.value = "";
  elements.quickAddCategory.value = categories[0] ?? "";
  wrap.hidden = false;
  elements.quickAddName?.focus();
}

function hideQuickAddForm() {
  elements.quickAddFormWrap.hidden = true;
}

async function handleQuickAddSubmit(event) {
  event.preventDefault();
  const name = elements.quickAddName?.value?.trim();
  const url = elements.quickAddUrl?.value?.trim();
  const category = elements.quickAddCategory?.value?.trim();
  if (!name || !url || !category) return;

  if (!isValidLaunchTarget(url)) {
    const normalized = normalizeUrl(url);
    if (!isValidLaunchTarget(normalized)) {
      alert("Please enter a valid URL or path.");
      return;
    }
  }

  const raw = { name, url, category, description: "Quick-added tool." };
  const tool = sanitizeTool(raw);
  if (!tool) return;

  state.tools = [...state.tools, tool];
  await saveStoredToolsSynced(normalizePinRanks(state.tools));
  hideQuickAddForm();
  render();
  updateStatusCards();
}

function handleKeyboardShortcut(event) {
  const active = document.activeElement;
  const isEditable =
    active &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable);
  if (isEditable) return;

  const modifierHeld = event.ctrlKey || event.metaKey;
  if (!modifierHeld) return;

  const key = event.key?.toLowerCase?.();
  if (!key || key.length > 1) return;

  const shiftHeld = event.shiftKey;
  const pinnedWithShortcuts = sortTools(
    state.tools.filter((tool) => tool.pinned && tool.shortcutLabel && tool.shortcutLabel.trim())
  );

  const toolsMatchingKey = pinnedWithShortcuts.filter((tool) => {
    const label = tool.shortcutLabel.trim();
    const labelKey = label.length === 1 ? label.toLowerCase() : parseShortcutKey(label);
    return labelKey === key;
  });

  const withExplicitShift = toolsMatchingKey.filter((t) => parseShortcutUsesShift(t.shortcutLabel));
  const plain = toolsMatchingKey.filter((t) => !parseShortcutUsesShift(t.shortcutLabel));

  let match = null;
  if (shiftHeld) {
    match = withExplicitShift[0] ?? plain[1] ?? plain[0];
  } else {
    match = plain[0] ?? null;
  }

  if (!match) return;

  event.preventDefault();
  state.launchHistory = recordLaunch(state.launchHistory, match.id);
  saveLaunchHistorySynced(state.launchHistory);
  updateStatusCards();

  const url = normalizeUrl(match.url);
  if (match.openMode === "same-tab") {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noreferrer");
  }
}

function parseShortcutKey(label) {
  const parts = label.split(/[\s+]+/);
  const last = parts[parts.length - 1];
  return last?.length === 1 ? last.toLowerCase() : null;
}

function parseShortcutUsesShift(label) {
  const lower = label.toLowerCase();
  return lower.includes("shift");
}

function handleToolGridKeydown(event) {
  const active = document.activeElement;
  if (
    !active ||
    active.tagName === "INPUT" ||
    active.tagName === "TEXTAREA" ||
    active.tagName === "SELECT" ||
    active.isContentEditable
  ) {
    return;
  }

  if (!elements.toolGrid?.contains(active)) return;
  const currentCard = active.classList?.contains("tool-card") ? active : active.closest(".tool-card");
  if (!currentCard) return;

  const cards = [...elements.toolGrid.querySelectorAll(".tool-card")];
  if (cards.length === 0) return;

  const key = event.key;
  if (key === "Enter") {
    if (active === currentCard) {
      const launchBtn = currentCard.querySelector(".launch-button");
      if (launchBtn) {
        event.preventDefault();
        launchBtn.click();
      }
    }
    return;
  }

  const dirs = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 };
  const step = dirs[key];
  if (step === undefined) return;

  event.preventDefault();

  const rect = elements.toolGrid.getBoundingClientRect();
  const firstCardRect = cards[0].getBoundingClientRect();
  const gap = 16;
  const cardWidth = firstCardRect.width + gap;
  const cols = Math.max(1, Math.floor(rect.width / cardWidth));
  const index = cards.indexOf(currentCard);
  if (index === -1) return;

  let nextIndex;
  if (key === "ArrowUp" || key === "ArrowDown") {
    nextIndex = index + step * cols;
  } else {
    nextIndex = index + step;
  }
  nextIndex = Math.max(0, Math.min(nextIndex, cards.length - 1));
  if (nextIndex !== index) {
    cards[nextIndex].focus();
  }
}

function render() {
  renderHeroQuickLinks();
  renderSpotlight();
  renderFilters();
  renderCards();
  updateStatusCards();
}

function renderHeroQuickLinks() {
  const quickLinks = sortTools(getToolsWithIntegrationEntries().filter((tool) => tool.surfaces.includes("hero")));
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
    getToolsWithIntegrationEntries().filter((tool) => tool.surfaces.includes("spotlight"))
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
  const categories = ["All", ...new Set(getToolsWithIntegrationEntries().map((tool) => tool.category).sort())];
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
  return sortTools(getToolsWithIntegrationEntries()).filter((tool) => {
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
    const isFiltered = state.activeCategory !== "All" || state.query;
    if (isFiltered) {
      emptyState.textContent = "No tools match that filter yet. Broaden the search or choose a different category.";
    } else {
      emptyState.innerHTML =
        'No tools yet. <a href="registry.html">Add one from Tool Registry</a> or <a href="packs.html">apply a Starter Pack</a>.';
    }
    elements.toolGrid.appendChild(emptyState);
    return;
  }

  const pinnedIds = sortTools(state.tools)
    .filter((tool) => tool.pinned)
    .map((tool) => tool.id);

  updateBatchActionBar();

  visibleTools.forEach((tool) => {
    const isVirtualIntegration = !tool.id;
    const fragment = elements.toolCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".tool-card");
    card.setAttribute("tabindex", "0");
    const selectWrap = fragment.querySelector(".tool-card__select-wrap");
    const selectCheckbox = fragment.querySelector(".tool-card__select");
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

    if (state.selectMode) {
      card.classList.add("tool-card--select-mode");
      selectWrap.hidden = isVirtualIntegration;
      selectCheckbox.disabled = isVirtualIntegration;
      if (!isVirtualIntegration) {
        selectCheckbox.checked = state.selectedToolIds.has(tool.id);
        selectCheckbox.addEventListener("change", () => {
          if (selectCheckbox.checked) state.selectedToolIds.add(tool.id);
          else state.selectedToolIds.delete(tool.id);
          updateBatchActionBar();
        });
      }
      card.querySelector(".tool-card__actions")?.classList.add("is-hidden");
    } else {
      card.classList.remove("tool-card--select-mode");
      selectWrap.hidden = true;
      card.querySelector(".tool-card__actions")?.classList.remove("is-hidden");
    }

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
    const isPinned = pinnedIndex >= 0 && !isVirtualIntegration;
    moveUpButton.hidden = !isPinned;
    moveDownButton.hidden = !isPinned;
    moveUpButton.disabled = !isPinned || pinnedIndex === 0;
    moveDownButton.disabled = !isPinned || pinnedIndex === pinnedIds.length - 1;

    if (!isVirtualIntegration) {
      moveUpButton.addEventListener("click", () => reorderPinnedTool(tool.id, "up"));
      moveDownButton.addEventListener("click", () => reorderPinnedTool(tool.id, "down"));

      editButton.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.href = `registry.html?edit=${encodeURIComponent(tool.id)}`;
      });
      deleteButton.addEventListener("click", () => removeTool(tool.id));
    } else {
      editButton.hidden = true;
      deleteButton.hidden = true;
      moveUpButton.hidden = true;
      moveDownButton.hidden = true;
    }

    elements.toolGrid.appendChild(fragment);
  });
}

function reorderPinnedTool(id, direction) {
  state.tools = movePinnedTool(state.tools, id, direction);
  saveStoredToolsSynced(normalizePinRanks(state.tools));
  render();
}

function removeTool(id) {
  const tool = state.tools.find((entry) => entry.id === id);
  if (!tool) return;

  const confirmed = window.confirm(`Delete ${tool.name} from your command deck?`);
  if (!confirmed) return;

  state.tools = state.tools.filter((entry) => entry.id !== id);
  state.launchHistory = filterHistoryForTools(state.launchHistory, state.tools);
  saveStoredToolsSynced(state.tools);
  saveLaunchHistorySynced(state.launchHistory);
  render();
  updateStatusCards();
}

function toggleSelectMode() {
  state.selectMode = !state.selectMode;
  if (!state.selectMode) {
    state.selectedToolIds.clear();
    exitSelectMode();
    return;
  }
  elements.batchActionBar.hidden = false;
  elements.selectModeBtn.textContent = "Done";
  render();
}

function exitSelectMode() {
  state.selectMode = false;
  state.selectedToolIds.clear();
  elements.batchActionBar.hidden = true;
  elements.selectModeBtn.textContent = "Select";
  render();
}

function updateBatchActionBar() {
  if (!elements.batchActionBar || !elements.batchSelectedCount) return;
  elements.batchSelectedCount.textContent = String(state.selectedToolIds.size);
  const hasSelection = state.selectedToolIds.size > 0;
  elements.batchPinBtn.disabled = !hasSelection;
  elements.batchDeleteBtn.disabled = !hasSelection;
  elements.batchCategorySelect.disabled = !hasSelection;

  const customCats = loadCustomCategories();
  const categories = [...new Set([...CATEGORY_OPTIONS, ...customCats, ...state.tools.map((t) => t.category)].sort())];
  const currentVal = elements.batchCategorySelect.value;
  elements.batchCategorySelect.innerHTML = '<option value="">Change category…</option>';
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    elements.batchCategorySelect.appendChild(opt);
  });
  elements.batchCategorySelect.value = currentVal && categories.includes(currentVal) ? currentVal : "";
}

function batchPinSelected() {
  const ids = [...state.selectedToolIds];
  if (ids.length === 0) return;
  let nextRank = getNextPinRank(state.tools);
  state.tools = state.tools.map((tool) => {
    if (!ids.includes(tool.id)) return tool;
    return { ...tool, pinned: true, pinRank: nextRank++ };
  });
  state.tools = normalizePinRanks(state.tools);
  saveStoredToolsSynced(state.tools);
  state.selectedToolIds.clear();
  render();
  updateStatusCards();
}

function batchDeleteSelected() {
  const ids = [...state.selectedToolIds];
  if (ids.length === 0) return;
  const confirmed = window.confirm(`Delete ${ids.length} tool(s)?`);
  if (!confirmed) return;
  state.tools = state.tools.filter((t) => !ids.includes(t.id));
  state.launchHistory = filterHistoryForTools(state.launchHistory, state.tools);
  saveStoredToolsSynced(state.tools);
  saveLaunchHistorySynced(state.launchHistory);
  state.selectedToolIds.clear();
  exitSelectMode();
  updateStatusCards();
}

function batchChangeCategory() {
  const newCategory = elements.batchCategorySelect?.value?.trim();
  if (!newCategory) return;
  const ids = [...state.selectedToolIds];
  if (ids.length === 0) return;
  state.tools = state.tools.map((tool) =>
    ids.includes(tool.id) ? { ...tool, category: newCategory } : tool
  );
  saveStoredToolsSynced(state.tools);
  state.selectedToolIds.clear();
  elements.batchCategorySelect.value = "";
  render();
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
    saveLaunchHistorySynced(state.launchHistory);
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
