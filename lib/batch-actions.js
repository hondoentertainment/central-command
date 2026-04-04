/**
 * Batch actions for select mode: pin, delete, change category for multiple tools.
 */
import { CATEGORY_OPTIONS } from "../data/presets.js";
import { getNextPinRank, normalizePinRanks, filterHistoryForTools } from "./tool-model.js";
import { loadCustomCategories } from "./storage.js";

/**
 * Create a batch actions controller.
 * @param {Object} opts
 * @param {Object} opts.state - App state { tools, launchHistory, selectMode, selectedToolIds }
 * @param {Object} opts.elements - DOM elements for batch UI
 * @param {() => void} opts.render - Trigger full re-render
 * @param {() => void} opts.updateStatusCards - Update status counters
 * @param {(tools: Array) => void} opts.saveTools - Save tools to storage
 * @param {(history: Array) => void} opts.saveHistory - Save history to storage
 */
export function createBatchActions({ state, elements, render, updateStatusCards, saveTools, saveHistory }) {
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
    elements.batchCategorySelect.innerHTML = '<option value="">Change category\u2026</option>';
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
    saveTools(state.tools);
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
    saveTools(state.tools);
    saveHistory(state.launchHistory);
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
    saveTools(state.tools);
    state.selectedToolIds.clear();
    elements.batchCategorySelect.value = "";
    render();
  }

  return {
    toggleSelectMode,
    exitSelectMode,
    updateBatchActionBar,
    batchPinSelected,
    batchDeleteSelected,
    batchChangeCategory,
  };
}
