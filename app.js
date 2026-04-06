import { ALL_PRESET_TOOLS, CATEGORY_OPTIONS, DEFAULT_TOOLS } from "./data/presets.js";
import { getIconMarkup } from "./lib/icons.js";
import { renderNav } from "./lib/nav.js";
import { fireLaunchHook, loadLaunchHookUrl, saveLaunchHookUrl } from "./lib/hooks.js";
import {
  createFallbackMetadataMap,
  filterHistoryForTools,
  getNextPinRank,
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
  loadCustomCategories,
  loadLayoutPreference,
  loadLaunchHistorySynced,
  loadNotes,
  loadStoredToolsSynced,
  performInitialSync,
  saveLayoutPreference,
  saveLaunchHistorySynced,
  saveNotesSynced,
  saveStoredToolsSynced,
  saveSurfacesPreferences,
  loadSurfacesPreferences,
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
import { showConfirmDialog, showAlertDialog } from "./lib/confirm-dialog.js";
import { setupKeyboardShortcuts, setupToolGridKeydown } from "./lib/keyboard-shortcuts.js";
import { createBatchActions } from "./lib/batch-actions.js";

const fallbackMetadataBySignature = createFallbackMetadataMap(ALL_PRESET_TOOLS);

const EXPORT_VERSION = 2;
const VIRTUALIZE_THRESHOLD = 50;
const OVERSCAN_ROWS = 2;
const ROW_HEIGHT = { grid: 180, list: 72, compact: 100 };

const state = {
  tools: [],
  activeCategory: "All",
  query: "",
  launchHistory: [],
  selectMode: false,
  selectedToolIds: new Set(),
  virtual: {
    cols: 3,
    visibleStart: 0,
    visibleEnd: 0,
    scrollTop: 0,
    viewHeight: 0,
    rowHeight: ROW_HEIGHT.grid,
    totalRows: 0,
    focusIndex: null,
  },
};

const elements = {
  searchInput: document.querySelector("#searchInput"),
  toolGridScrollWrap: document.querySelector("#toolGridScrollWrap"),
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
  statusAnnouncer: document.querySelector("#statusAnnouncer"),
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
  launchHookUrlInput: document.querySelector("#launchHookUrlInput"),
  importBackupBtn: document.querySelector("#importBackupBtn"),
  importBackupInput: document.querySelector("#importBackupInput"),
  importFromUrlBtn: document.querySelector("#importFromUrlBtn"),
  copyBackupBtn: document.querySelector("#copyBackupBtn"),
  toolsMoreBtn: document.querySelector("#toolsMoreBtn"),
  toolsMoreMenu: document.querySelector("#toolsMoreMenu"),
  creativeHubEnabled: document.querySelector("#creativeHubEnabled"),
  creativeHubShowInNav: document.querySelector("#creativeHubShowInNav"),
  creativeHubShowInPalette: document.querySelector("#creativeHubShowInPalette"),
  creativeHubShowAsTool: document.querySelector("#creativeHubShowAsTool"),
  creativeHubUrl: document.querySelector("#creativeHubUrl"),
  creativeHubOpenMode: document.querySelector("#creativeHubOpenMode"),
  mainContent: document.querySelector(".dashboard-main"),
  importUrlDialogWrap: document.querySelector("#importUrlDialogWrap"),
  importUrlInput: document.querySelector("#importUrlInput"),
  importUrlConfirmBtn: document.querySelector("#importUrlConfirmBtn"),
  importUrlCancelBtn: document.querySelector("#importUrlCancelBtn"),
  importUrlStatus: document.querySelector("#importUrlStatus"),
  shareDeckBtn: document.querySelector("#shareDeckBtn"),
  scheduleExportBtn: document.querySelector("#scheduleExportBtn"),
  scheduledExportDialogWrap: document.querySelector("#scheduledExportDialogWrap"),
  scheduledExportInterval: document.querySelector("#scheduledExportInterval"),
  scheduledExportSaveBtn: document.querySelector("#scheduledExportSaveBtn"),
  scheduledExportCancelBtn: document.querySelector("#scheduledExportCancelBtn"),
  scheduledExportStatus: document.querySelector("#scheduledExportStatus"),
};

// --- Batch actions (delegated to module) ---
const batch = createBatchActions({
  state,
  elements,
  render,
  updateStatusCards,
  saveTools: (tools) => saveStoredToolsSynced(normalizePinRanks(tools)),
  saveHistory: (history) => saveLaunchHistorySynced(history),
});

initialize();

async function initialize() {
  let tools = await loadStoredToolsSynced(
    (value) => hydrateTools(value, fallbackMetadataBySignature),
    DEFAULT_TOOLS
  );

  const params = new URLSearchParams(location.search);
  const importUrl = params.get("import");
  const deckParam = params.get("deck");
  if (importUrl) {
    const imported = await fetchAndImportBackup(importUrl);
    if (imported) {
      tools = imported.tools;
      state.launchHistory = imported.history;
      await saveStoredToolsSynced(tools);
      await saveLaunchHistorySynced(state.launchHistory);
      if (imported.notes != null) saveNotesSynced(imported.notes);
      showToast(`Imported ${tools.length} tools from URL.`);
      history.replaceState(null, "", location.pathname + location.hash);
    }
  } else if (deckParam) {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(globalThis.atob(deckParam))));
      const rawTools = Array.isArray(decoded) ? decoded : decoded?.tools;
      const deckTools = hydrateTools(rawTools, fallbackMetadataBySignature);
      if (deckTools.length) {
        tools = normalizePinRanks(deckTools);
        state.launchHistory = filterHistoryForTools(
          sanitizeLaunchHistory(decoded?.launchHistory),
          tools
        );
        await saveStoredToolsSynced(tools);
        await saveLaunchHistorySynced(state.launchHistory);
        if (typeof decoded?.notes === "string") saveNotesSynced(decoded.notes);
        showToast(`Imported ${tools.length} tools from shared deck link.`, "success");
      }
    } catch {
      showToast("Could not load shared deck. The link may be corrupted.", "error");
    }
    history.replaceState(null, "", location.pathname + location.hash);
  } else if (!hasSavedTools()) {
    const fromFile = await fetchAndImportBackup("./backup.json");
    if (fromFile?.tools?.length) {
      tools = fromFile.tools;
      state.launchHistory = fromFile.history;
      await saveStoredToolsSynced(tools);
      await saveLaunchHistorySynced(state.launchHistory);
      if (fromFile.notes != null) saveNotesSynced(fromFile.notes);
      showToast(`Loaded ${tools.length} tools from backup.json.`);
    }
  }

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
  setupVirtualizationObservers();
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

  elements.importBackupBtn?.addEventListener("click", () => {
    closeToolsMoreMenu();
    elements.importBackupInput?.click();
  });
  elements.importBackupInput?.addEventListener("change", handleImportBackup);
  elements.importFromUrlBtn?.addEventListener("click", openImportUrlDialog);
  elements.importUrlConfirmBtn?.addEventListener("click", handleImportUrlConfirm);
  elements.importUrlCancelBtn?.addEventListener("click", closeImportUrlDialog);
  elements.copyBackupBtn?.addEventListener("click", handleCopyBackupToClipboard);
  elements.shareDeckBtn?.addEventListener("click", handleShareDeckLink);
  elements.scheduleExportBtn?.addEventListener("click", openScheduledExportDialog);
  elements.scheduledExportSaveBtn?.addEventListener("click", handleScheduledExportSave);
  elements.scheduledExportCancelBtn?.addEventListener("click", closeScheduledExportDialog);
  elements.selectModeBtn?.addEventListener("click", () => {
    closeToolsMoreMenu();
    toggleSelectMode();
  });
  elements.surfacesSettingsBtn?.addEventListener("click", () => closeToolsMoreMenu());
  setupToolsMoreMenu();
  elements.batchPinBtn?.addEventListener("click", batchPinSelected);
  elements.batchDeleteBtn?.addEventListener("click", batchDeleteSelected);
  elements.batchCategorySelect?.addEventListener("change", batchChangeCategory);
  elements.batchDoneBtn?.addEventListener("click", exitSelectMode);

  document.addEventListener("keydown", handleGlobalShortcuts);
  document.addEventListener("keydown", handleKeyboardShortcut);
  document.addEventListener("keydown", handleToolGridKeydown);
  document.addEventListener("click", () => {
    document.querySelectorAll(".tool-card__more-menu").forEach((m) => { m.hidden = true; });
    document.querySelectorAll(".tool-card__more-trigger").forEach((b) => b.setAttribute("aria-expanded", "false"));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".tool-card__more-menu").forEach((m) => { m.hidden = true; });
      document.querySelectorAll(".tool-card__more-trigger").forEach((b) => b.setAttribute("aria-expanded", "false"));
    }
  });
  elements.selectModeBtn?.addEventListener("click", batch.toggleSelectMode);
  elements.batchPinBtn?.addEventListener("click", batch.batchPinSelected);
  elements.batchDeleteBtn?.addEventListener("click", batch.batchDeleteSelected);
  elements.batchCategorySelect?.addEventListener("change", batch.batchChangeCategory);
  elements.batchDoneBtn?.addEventListener("click", batch.exitSelectMode);

  setupKeyboardShortcuts({
    getTools: () => state.tools,
    getLaunchHistory: () => state.launchHistory,
    setLaunchHistory: (h) => { state.launchHistory = h; },
    saveLaunchHistory: (h) => saveLaunchHistorySynced(h),
    onLaunch: updateStatusCards,
  });
  setupToolGridKeydown(elements.toolGrid);

  render();
  checkScheduledExport();
}

function handleGlobalShortcuts(event) {
  const active = document.activeElement;
  const isEditable =
    active &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable);

  if (event.key === "Escape") {
    if (elements.surfacesSettingsPanel && !elements.surfacesSettingsPanel.hidden) {
      event.preventDefault();
      closeSurfacesPanel();
      return;
    }
    if (elements.importUrlDialogWrap && !elements.importUrlDialogWrap.hidden) {
      event.preventDefault();
      closeImportUrlDialog();
      return;
    }
    if (elements.scheduledExportDialogWrap && !elements.scheduledExportDialogWrap.hidden) {
      event.preventDefault();
      closeScheduledExportDialog();
      return;
    }
    if (elements.quickAddFormWrap && !elements.quickAddFormWrap.hidden) {
      event.preventDefault();
      hideQuickAddForm();
      elements.addToolBtn?.focus();
      return;
    }
    if (state.selectMode) {
      event.preventDefault();
      exitSelectMode();
      elements.selectModeBtn?.focus();
      return;
    }
    return;
  }

  if (!isEditable && event.key === "/") {
    event.preventDefault();
    elements.searchInput?.focus();
  }
}

function applyLayoutClass(layout) {
  if (!elements.toolGrid) return;
  elements.toolGrid.classList.remove("tool-grid--list", "tool-grid--compact");
  if (layout === "list") elements.toolGrid.classList.add("tool-grid--list");
  else if (layout === "compact") elements.toolGrid.classList.add("tool-grid--compact");
}

function setupVirtualizationObservers() {
  const wrap = elements.toolGridScrollWrap;
  if (!wrap) return;

  wrap.addEventListener("scroll", onVirtualScroll, { passive: true });

  const ro = new ResizeObserver(() => {
    const visibleTools = getVisibleTools();
    if (visibleTools.length >= VIRTUALIZE_THRESHOLD) {
      computeVirtualCols();
      computeVirtualVisibleRange(visibleTools);
      renderVirtualizedCards(visibleTools);
    }
  });
  ro.observe(wrap);
  // On wrap resize, cols and totalRows are recalc'd via computeVirtualCols (wrap.clientWidth, getLayoutMode()) and computeVirtualVisibleRange.
}

function closeToolsMoreMenu() {
  const menu = elements.toolsMoreMenu;
  const btn = elements.toolsMoreBtn;
  if (menu && !menu.hidden) {
    menu.hidden = true;
    btn?.setAttribute("aria-expanded", "false");
  }
}

function setupToolsMoreMenu() {
  const btn = elements.toolsMoreBtn;
  const menu = elements.toolsMoreMenu;
  if (!btn || !menu) return;
  const focusItem = (index) => {
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]:not([hidden])'));
    if (items.length === 0) return;
    const bounded = ((index % items.length) + items.length) % items.length;
    items[bounded].focus();
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !menu.hidden;
    menu.hidden = isOpen;
    btn.setAttribute("aria-expanded", String(!isOpen));
    if (!isOpen) requestAnimationFrame(() => focusItem(0));
  });
  menu.addEventListener("click", (e) => e.stopPropagation());
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]:not([hidden])'));
    if (items.length === 0) return;
    const currentIndex = Math.max(0, items.indexOf(document.activeElement));
    if (event.key === "ArrowDown") focusItem(currentIndex + 1);
    if (event.key === "ArrowUp") focusItem(currentIndex - 1);
    if (event.key === "Home") focusItem(0);
    if (event.key === "End") focusItem(items.length - 1);
  });
  document.addEventListener("click", () => closeToolsMoreMenu());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeToolsMoreMenu();
  });
}

function setMainContentInert(inert) {
  if (inert) {
    document.body.classList.add("modal-open");
  } else {
    document.body.classList.remove("modal-open");
  }
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
      render();
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

let surfacesPanelTabTrapHandler = null;

function getSurfacesPanelFocusables() {
  const panel = elements.surfacesSettingsPanel;
  if (!panel) return [];
  const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(panel.querySelectorAll(sel));
}

function addSurfacesPanelTabTrap() {
  if (surfacesPanelTabTrapHandler) return;
  surfacesPanelTabTrapHandler = (e) => {
    const panel = elements.surfacesSettingsPanel;
    if (!panel || panel.hidden) return;
    if (e.key !== "Tab") return;
    if (!panel.contains(document.activeElement)) return;
    const focusables = getSurfacesPanelFocusables();
    if (focusables.length < 2) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", surfacesPanelTabTrapHandler);
}

function removeSurfacesPanelTabTrap() {
  if (surfacesPanelTabTrapHandler) {
    document.removeEventListener("keydown", surfacesPanelTabTrapHandler);
    surfacesPanelTabTrapHandler = null;
  }
}

let quickAddFormTabTrapHandler = null;

function getQuickAddFormFocusables() {
  const wrap = elements.quickAddFormWrap;
  if (!wrap || wrap.hidden) return [];
  const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(wrap.querySelectorAll(sel));
}

function addQuickAddFormTabTrap() {
  if (quickAddFormTabTrapHandler) return;
  quickAddFormTabTrapHandler = (e) => {
    const wrap = elements.quickAddFormWrap;
    if (!wrap || wrap.hidden) return;
    if (e.key !== "Tab") return;
    if (!wrap.contains(document.activeElement)) return;
    const focusables = getQuickAddFormFocusables();
    if (focusables.length < 2) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", quickAddFormTabTrapHandler);
}

function removeQuickAddFormTabTrap() {
  if (quickAddFormTabTrapHandler) {
    document.removeEventListener("keydown", quickAddFormTabTrapHandler);
    quickAddFormTabTrapHandler = null;
  }
}

function closeSurfacesPanel() {
  if (!elements.surfacesSettingsPanel) return;
  elements.surfacesSettingsPanel.hidden = true;
  elements.surfacesSettingsBtn?.setAttribute("aria-expanded", "false");
  removeSurfacesPanelTabTrap();
  setMainContentInert(false);
  elements.surfacesSettingsBtn?.focus();
}

function setupSurfacesSettings() {
  const prefs = loadSurfacesPreferences();
  const surfaces = prefs?.command ?? DEFAULT_SURFACES.command;
  if (elements.surfacesShowHero) elements.surfacesShowHero.checked = surfaces.includes("hero");
  if (elements.surfacesShowSpotlight) elements.surfacesShowSpotlight.checked = surfaces.includes("spotlight");
  if (elements.launchHookUrlInput) elements.launchHookUrlInput.value = loadLaunchHookUrl();

  elements.surfacesSettingsBtn?.addEventListener("click", () => {
    const panel = elements.surfacesSettingsPanel;
    if (!panel) return;
    panel.hidden = !panel.hidden;
    elements.surfacesSettingsBtn?.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) {
      setMainContentInert(true);
      addSurfacesPanelTabTrap();
      requestAnimationFrame(() => {
        const firstFocusable = getSurfacesPanelFocusables()[0];
        firstFocusable?.focus();
      });
    } else {
      setMainContentInert(false);
      removeSurfacesPanelTabTrap();
      elements.surfacesSettingsBtn?.focus();
    }
  });

  elements.launchHookUrlInput?.addEventListener("change", () => {
    saveLaunchHookUrl(elements.launchHookUrlInput?.value ?? "");
  });
  elements.launchHookUrlInput?.addEventListener("blur", () => {
    saveLaunchHookUrl(elements.launchHookUrlInput?.value ?? "");
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
  const hydrated = sanitizeTool(creativeHubTool);
  if (hydrated) hydrated._virtualIntegration = true;
  return [...state.tools, hydrated].filter(Boolean);
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
  setMainContentInert(true);
  addQuickAddFormTabTrap();
  requestAnimationFrame(() => {
    elements.quickAddName?.focus();
  });
}

function hideQuickAddForm() {
  elements.quickAddFormWrap.hidden = true;
  setMainContentInert(false);
  removeQuickAddFormTabTrap();
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
      showAlertDialog({ title: "Invalid URL", message: "Please enter a valid URL or path." });
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
  showToast("Tool added.", "success");
}

/**
 * Fetch JSON from URL and return parsed backup { tools, history, notes } or null.
 * @param {string} url - Absolute or relative URL to fetch
 */
async function fetchAndImportBackup(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const payload = await res.json();
    const rawTools = Array.isArray(payload) ? payload : payload?.tools;
    const tools = hydrateTools(rawTools, fallbackMetadataBySignature);
    if (!tools.length) return null;
    const history = filterHistoryForTools(
      sanitizeLaunchHistory(payload?.launchHistory),
      tools
    );
    return {
      tools: normalizePinRanks(tools),
      history,
      notes: typeof payload?.notes === "string" ? payload.notes : null,
    };
  } catch {
    return null;
  }
}

async function handleImportBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const rawTools = Array.isArray(payload) ? payload : payload?.tools;
    const importedTools = hydrateTools(rawTools, fallbackMetadataBySignature);
    if (importedTools.length === 0) {
      showToast("No valid tools found in that backup.", "error");
      return;
    }
    state.tools = normalizePinRanks(importedTools);
    state.launchHistory = filterHistoryForTools(
      sanitizeLaunchHistory(payload?.launchHistory),
      state.tools
    );
    await saveStoredToolsSynced(state.tools);
    await saveLaunchHistorySynced(state.launchHistory);
    if (typeof payload?.notes === "string") {
      saveNotesSynced(payload.notes);
    }
    render();
    updateStatusCards();
    showToast(`Imported ${importedTools.length} tools from ${file.name}.`, "success");
  } catch {
    showToast("Could not import that backup. Use a JSON file from Export.", "error");
  }
}

function openImportUrlDialog() {
  closeToolsMoreMenu();
  const wrap = elements.importUrlDialogWrap;
  if (!wrap) return;
  if (elements.importUrlInput) elements.importUrlInput.value = "";
  if (elements.importUrlStatus) elements.importUrlStatus.textContent = "";
  wrap.hidden = false;
  setMainContentInert(true);
  requestAnimationFrame(() => elements.importUrlInput?.focus());
}

function closeImportUrlDialog() {
  const wrap = elements.importUrlDialogWrap;
  if (wrap) wrap.hidden = true;
  setMainContentInert(false);
}

async function handleImportUrlConfirm() {
  const url = elements.importUrlInput?.value?.trim();
  if (!url) {
    if (elements.importUrlStatus) elements.importUrlStatus.textContent = "Please enter a URL.";
    return;
  }
  if (elements.importUrlStatus) elements.importUrlStatus.textContent = "Importing…";
  elements.importUrlConfirmBtn.disabled = true;
  try {
    const imported = await fetchAndImportBackup(url);
    if (!imported) {
      if (elements.importUrlStatus) elements.importUrlStatus.textContent = "Could not load backup from that URL.";
      elements.importUrlConfirmBtn.disabled = false;
      return;
    }
    state.tools = normalizePinRanks(imported.tools);
    state.launchHistory = filterHistoryForTools(imported.history, state.tools);
    await saveStoredToolsSynced(state.tools);
    await saveLaunchHistorySynced(state.launchHistory);
    if (imported.notes != null) saveNotesSynced(imported.notes);
    closeImportUrlDialog();
    render();
    updateStatusCards();
    showToast(`Imported ${state.tools.length} tools from URL.`, "success");
  } catch {
    if (elements.importUrlStatus) elements.importUrlStatus.textContent = "Could not import from URL.";
  } finally {
    elements.importUrlConfirmBtn.disabled = false;
  }
}

async function handleShareDeckLink() {
  closeToolsMoreMenu();
  const payload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tools: state.tools,
    notes: loadNotes(),
    launchHistory: state.launchHistory,
  };
  const encoded = globalThis.btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const shareUrl = `${location.origin}${location.pathname}?deck=${encoded}`;

  if (encoded.length > 6000) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      showToast("Deck is too large for a URL. Backup JSON copied to clipboard instead.", "info");
    } catch {
      showToast("Deck is too large to share as a link.", "error");
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast("Shareable deck link copied to clipboard.", "success");
  } catch {
    showToast("Could not copy share link.", "error");
  }
}

const SCHEDULED_EXPORT_KEY = "central-command.scheduled-export";

function loadScheduledExport() {
  try {
    const raw = localStorage.getItem(SCHEDULED_EXPORT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveScheduledExport(config) {
  try {
    if (config) {
      localStorage.setItem(SCHEDULED_EXPORT_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(SCHEDULED_EXPORT_KEY);
    }
  } catch {}
}

function openScheduledExportDialog() {
  closeToolsMoreMenu();
  const wrap = elements.scheduledExportDialogWrap;
  if (!wrap) return;
  const config = loadScheduledExport();
  if (elements.scheduledExportInterval) {
    elements.scheduledExportInterval.value = config?.interval || "";
  }
  if (elements.scheduledExportStatus) {
    elements.scheduledExportStatus.textContent = config?.lastExport
      ? `Last export: ${new Date(config.lastExport).toLocaleString()}`
      : "";
  }
  wrap.hidden = false;
  setMainContentInert(true);
}

function closeScheduledExportDialog() {
  const wrap = elements.scheduledExportDialogWrap;
  if (wrap) wrap.hidden = true;
  setMainContentInert(false);
}

function handleScheduledExportSave() {
  const interval = elements.scheduledExportInterval?.value || "";
  if (!interval) {
    saveScheduledExport(null);
    closeScheduledExportDialog();
    showToast("Scheduled export disabled.", "info");
    return;
  }
  const config = loadScheduledExport() || {};
  config.interval = interval;
  saveScheduledExport(config);
  closeScheduledExportDialog();
  showToast(`Export scheduled: ${interval}.`, "success");
  checkScheduledExport();
}

function checkScheduledExport() {
  const config = loadScheduledExport();
  if (!config?.interval) return;

  const now = Date.now();
  const last = config.lastExport ? new Date(config.lastExport).getTime() : 0;
  const intervals = { daily: 86400000, weekly: 604800000, monthly: 2592000000 };
  const ms = intervals[config.interval];
  if (!ms || (now - last) < ms) return;

  const payload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tools: state.tools,
    notes: loadNotes(),
    launchHistory: state.launchHistory,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `central-command-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);

  config.lastExport = new Date().toISOString();
  saveScheduledExport(config);
  showToast("Scheduled backup exported.", "success");
}

async function handleCopyBackupToClipboard() {
  closeToolsMoreMenu();
  const payload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tools: state.tools,
    notes: loadNotes(),
    launchHistory: state.launchHistory,
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    showToast("Backup copied to clipboard.", "success");
  } catch {
    showToast("Could not copy to clipboard.", "error");
  }
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
  fireLaunchHook({ toolId: match.id, toolName: match.name, url });
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

  const visibleTools = getVisibleTools();
  if (visibleTools.length === 0) return;

  const isVirtualized = visibleTools.length >= VIRTUALIZE_THRESHOLD;
  const cards = [...elements.toolGrid.querySelectorAll(".tool-card")];

  let currentIndex;
  let cols;
  if (isVirtualized) {
    const idxAttr = currentCard.dataset?.index;
    if (idxAttr === undefined) return;
    currentIndex = parseInt(idxAttr, 10);
    cols = state.virtual.cols;
  } else {
    if (cards.length === 0) return;
    currentIndex = cards.indexOf(currentCard);
    if (currentIndex === -1) return;
    const rect = elements.toolGrid.getBoundingClientRect();
    const firstCardRect = cards[0].getBoundingClientRect();
    const gap = 16;
    const cardWidth = firstCardRect.width + gap;
    cols = Math.max(1, Math.floor(rect.width / cardWidth));
  }

  const layout = getLayoutMode();

  let nextIndex;
  if (key === "ArrowUp" || key === "ArrowDown") {
    nextIndex = currentIndex + step * cols;
  } else {
    nextIndex = currentIndex + step;
  }
  nextIndex = Math.max(0, Math.min(nextIndex, visibleTools.length - 1));
  if (nextIndex === currentIndex) return;

  event.preventDefault();

  if (isVirtualized) {
    const wrap = elements.toolGridScrollWrap;
    const rowHeight = ROW_HEIGHT[layout] ?? ROW_HEIGHT.grid;
    const targetRow = Math.floor(nextIndex / cols);
    const targetScrollTop = Math.max(0, targetRow * rowHeight - rowHeight * 0.5);
    wrap.scrollTop = targetScrollTop;
    state.virtual.focusIndex = nextIndex;
    computeVirtualVisibleRange(visibleTools);
    renderVirtualizedCards(visibleTools);
    requestAnimationFrame(() => {
      const view = elements.toolGrid?.querySelector(".tool-grid__view");
      const focusCard = view?.querySelector(`[data-index="${nextIndex}"]`);
      if (focusCard) focusCard.focus();
      state.virtual.focusIndex = null;
    });
  } else {
    const cards = [...elements.toolGrid.querySelectorAll(".tool-card")];
    if (cards[nextIndex]) cards[nextIndex].focus();
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
    const wrap = document.createElement("div");
    wrap.className = "spotlight-empty";
    wrap.innerHTML =
      '<p class="spotlight-empty__text">Mark tools for spotlight to keep your core stack visible.</p><p class="spotlight-empty__link"><a href="#toolGridScrollWrap">Add tools in the deck below</a> or <a href="registry.html">Registry</a> and turn on "Show in spotlight".</p>';
    elements.spotlightGrid.appendChild(wrap);
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
    button.setAttribute("aria-pressed", state.activeCategory === category ? "true" : "false");
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

function getLayoutMode() {
  if (elements.toolGrid?.classList.contains("tool-grid--list")) return "list";
  if (elements.toolGrid?.classList.contains("tool-grid--compact")) return "compact";
  return "grid";
}

function computeVirtualCols() {
  const wrap = elements.toolGridScrollWrap;
  if (!wrap) return state.virtual.cols;
  const width = wrap.clientWidth || 400;
  const layout = getLayoutMode();
  const gap = 16;
  if (layout === "list") {
    state.virtual.cols = 1;
    return 1;
  }
  const minCol = layout === "compact" ? 160 : 240;
  const cols = Math.max(1, Math.floor((width + gap) / (minCol + gap)));
  state.virtual.cols = cols;
  return cols;
}

function computeVirtualVisibleRange(visibleTools) {
  const wrap = elements.toolGridScrollWrap;
  const grid = elements.toolGrid;
  if (!wrap || !grid || visibleTools.length === 0) {
    state.virtual.totalRows = 0;
    return;
  }

  const layout = getLayoutMode();
  const rowHeight = ROW_HEIGHT[layout] ?? ROW_HEIGHT.grid;
  const cols = computeVirtualCols();
  const totalRows = Math.ceil(visibleTools.length / cols);
  if (totalRows <= 0) {
    state.virtual.totalRows = 0;
    return;
  }

  const scrollTop = wrap.scrollTop;
  const viewHeight = Math.max(1, wrap.clientHeight || 400);

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS);
  let endRow = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + viewHeight) / rowHeight) - 1 + OVERSCAN_ROWS
  );
  endRow = Math.max(0, endRow);

  const visibleStart = Math.max(0, startRow * cols);
  const visibleEnd = Math.min(visibleTools.length - 1, (endRow + 1) * cols - 1);

  state.virtual.visibleStart = visibleStart;
  state.virtual.visibleEnd = visibleEnd;
  state.virtual.scrollTop = scrollTop;
  state.virtual.viewHeight = viewHeight;
  state.virtual.rowHeight = rowHeight;
  state.virtual.totalRows = totalRows;
}

let virtualScrollRaf = null;
function onVirtualScroll() {
  if (virtualScrollRaf) return;
  virtualScrollRaf = requestAnimationFrame(() => {
    virtualScrollRaf = null;
    const visibleTools = getVisibleTools();
    if (visibleTools.length < VIRTUALIZE_THRESHOLD) return;
    computeVirtualVisibleRange(visibleTools);
    renderVirtualizedCards(visibleTools);
  });
}

function createCardElement(tool, pinnedIds, opts = {}) {
  const isVirtualIntegration = !!tool._virtualIntegration;
  const fragment = elements.toolCardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".tool-card");
  card.setAttribute("tabindex", "0");
  if (opts.dataIndex != null) card.dataset.index = String(opts.dataIndex);
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
  const moreTrigger = fragment.querySelector(".tool-card__more-trigger");
  const moreMenu = fragment.querySelector(".tool-card__more-menu");
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

  card.addEventListener("click", (e) => {
    if (e.target.closest("a, button, [role='menu']")) return;
    e.preventDefault();
    launchButton?.click();
  });

  if (moreTrigger && moreMenu) {
    const focusMenuItem = (index) => {
      const items = Array.from(moreMenu.querySelectorAll("button:not([hidden])"));
      if (items.length === 0) return;
      const bounded = ((index % items.length) + items.length) % items.length;
      items[bounded].focus();
    };
    moreTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isOpen = !moreMenu.hidden;
      moreMenu.hidden = isOpen;
      moreTrigger.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) requestAnimationFrame(() => focusMenuItem(0));
    });
    const closeMore = () => {
      moreMenu.hidden = true;
      moreTrigger.setAttribute("aria-expanded", "false");
      moreTrigger.focus();
    };
    moreMenu.querySelectorAll("button").forEach((item) => item.addEventListener("click", closeMore));
    moreMenu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMore();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") {
        return;
      }
      event.preventDefault();
      const items = Array.from(moreMenu.querySelectorAll("button:not([hidden])"));
      if (items.length === 0) return;
      const currentIndex = Math.max(0, items.indexOf(document.activeElement));
      if (event.key === "ArrowDown") focusMenuItem(currentIndex + 1);
      if (event.key === "ArrowUp") focusMenuItem(currentIndex - 1);
      if (event.key === "Home") focusMenuItem(0);
      if (event.key === "End") focusMenuItem(items.length - 1);
    });
  }

  const pinnedIndex = pinnedIds.indexOf(tool.id);
  const isPinned = pinnedIndex >= 0 && !isVirtualIntegration;
  if (moveUpButton) { moveUpButton.hidden = !isPinned; moveUpButton.disabled = !isPinned || pinnedIndex === 0; }
  if (moveDownButton) { moveDownButton.hidden = !isPinned; moveDownButton.disabled = !isPinned || pinnedIndex === pinnedIds.length - 1; }

  if (!isVirtualIntegration) {
    moveUpButton?.addEventListener("click", () => reorderPinnedTool(tool.id, "up"));
    moveDownButton?.addEventListener("click", () => reorderPinnedTool(tool.id, "down"));
    editButton?.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = `registry.html?edit=${encodeURIComponent(tool.id)}`;
    });
    deleteButton?.addEventListener("click", () => removeTool(tool.id));
  } else {
    if (editButton) editButton.hidden = true;
    if (deleteButton) deleteButton.hidden = true;
    if (moveUpButton) moveUpButton.hidden = true;
    if (moveDownButton) moveDownButton.hidden = true;
  }

  return { fragment, card };
}

function renderVirtualizedCards(visibleTools) {
  const pinnedIds = sortTools(state.tools)
    .filter((tool) => tool.pinned)
    .map((tool) => tool.id);

  const { visibleStart, visibleEnd, rowHeight, cols, totalRows } = state.virtual;
  const viewTop = Math.floor(visibleStart / cols) * rowHeight;

  const wrap = elements.toolGridScrollWrap;
  const grid = elements.toolGrid;
  if (!wrap || !grid) return;

  const totalHeight = Math.max(0, totalRows * rowHeight);
  grid.style.height = `${totalHeight}px`;
  grid.style.setProperty("--tool-cols", String(cols));

  let view = grid.querySelector(".tool-grid__view");
  if (!view) {
    view = document.createElement("div");
    view.className = "tool-grid__view";
    grid.appendChild(view);
  }

  view.style.top = `${viewTop}px`;
  view.innerHTML = "";

  for (let i = visibleStart; i <= visibleEnd; i++) {
    const tool = visibleTools[i];
    const { fragment } = createCardElement(tool, pinnedIds, {
      dataIndex: i,
    });
    view.appendChild(fragment);
  }

  if (state.virtual.focusIndex != null) {
    const idx = state.virtual.focusIndex;
    if (idx >= visibleStart && idx <= visibleEnd) {
      requestAnimationFrame(() => {
        const focusCard = view.querySelector(`[data-index="${idx}"]`);
        if (focusCard) focusCard.focus();
        state.virtual.focusIndex = null;
      });
    }
  }
}

function renderCards() {
  const visibleTools = getVisibleTools();
  const wrap = elements.toolGridScrollWrap;
  const grid = elements.toolGrid;

  if (!grid) return;

  const useVirtualization = visibleTools.length >= VIRTUALIZE_THRESHOLD;

  if (wrap) {
    wrap.classList.toggle("tool-grid-scroll-wrap--virtualized", useVirtualization);
  }

  grid.classList.toggle("tool-grid--virtualized", useVirtualization);
  grid.innerHTML = "";

  if (visibleTools.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    const isFiltered = state.activeCategory !== "All" || state.query;
    if (isFiltered) {
      emptyState.innerHTML =
        "<p class=\"empty-state__title\">No tools match that filter</p><p class=\"empty-state__text\">Broaden the search or choose a different category.</p>";
    } else {
      emptyState.innerHTML =
        '<p class="empty-state__title">No tools yet</p><p class="empty-state__text">Add your first tool or start from a preset pack.</p>' +
        '<div class="empty-state__actions"><button type="button" class="primary-button empty-state__cta">Add your first tool</button> <a href="packs.html" class="ghost-button">Choose a starter pack</a></div>';
      const cta = emptyState.querySelector(".empty-state__cta");
      if (cta) cta.addEventListener("click", () => showQuickAddForm());
    }
    grid.appendChild(emptyState);
    return;
  }

  updateBatchActionBar();

  const pinnedIds = sortTools(state.tools)
    .filter((tool) => tool.pinned)
    .map((tool) => tool.id);

  if (useVirtualization) {
    if (wrap) {
      computeVirtualVisibleRange(visibleTools);
      wrap.scrollTop = state.virtual.scrollTop;
    }
    renderVirtualizedCards(visibleTools);
    return;
  }

  visibleTools.forEach((tool) => {
    const { fragment } = createCardElement(tool, pinnedIds);
    grid.appendChild(fragment);
  });
}

function reorderPinnedTool(id, direction) {
  state.tools = movePinnedTool(state.tools, id, direction);
  saveStoredToolsSynced(normalizePinRanks(state.tools));
  render();
}

async function removeTool(id) {
  const tool = state.tools.find((entry) => entry.id === id);
  if (!tool) return;

  const confirmed = await showConfirmDialog({
    title: `Delete ${tool.name}?`,
    message: "This tool will be removed from your command deck. This cannot be undone.",
    confirmLabel: "Delete",
    destructive: true,
  });
  if (!confirmed) return;

  state.tools = state.tools.filter((entry) => entry.id !== id);
  state.launchHistory = filterHistoryForTools(state.launchHistory, state.tools);
  saveStoredToolsSynced(state.tools);
  saveLaunchHistorySynced(state.launchHistory);
  render();
  updateStatusCards();
}

function announceStatus(message) {
  const el = elements.statusAnnouncer;
  if (!el) return;
  el.textContent = "";
  requestAnimationFrame(() => {
    el.textContent = message;
  });
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
  announceStatus("Select mode. Use checkboxes to select tools, then use bulk actions.");
  render();
}

function exitSelectMode() {
  state.selectMode = false;
  state.selectedToolIds.clear();
  elements.batchActionBar.hidden = true;
  elements.selectModeBtn.textContent = "Select";
  announceStatus("Select mode closed.");
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
  announceStatus(`${ids.length} tool(s) pinned.`);
  render();
  updateStatusCards();
}

async function batchDeleteSelected() {
  const ids = [...state.selectedToolIds];
  if (ids.length === 0) return;
  const confirmed = await showConfirmDialog({
    title: `Delete ${ids.length} tool(s)?`,
    message: "Selected tools will be permanently removed. This cannot be undone.",
    confirmLabel: "Delete all",
    destructive: true,
  });
  if (!confirmed) return;
  state.tools = state.tools.filter((t) => !ids.includes(t.id));
  state.launchHistory = filterHistoryForTools(state.launchHistory, state.tools);
  saveStoredToolsSynced(state.tools);
  saveLaunchHistorySynced(state.launchHistory);
  state.selectedToolIds.clear();
  announceStatus(`${ids.length} tool(s) deleted.`);
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
