/**
 * Keyboard shortcut handling for pinned tools with Ctrl/Cmd+key combos.
 */
import { normalizeUrl, recordLaunch, sortTools } from "./tool-model.js";

function parseShortcutKey(label) {
  const parts = label.split(/[\s+]+/);
  const last = parts[parts.length - 1];
  return last?.length === 1 ? last.toLowerCase() : null;
}

function parseShortcutUsesShift(label) {
  return label.toLowerCase().includes("shift");
}

/**
 * Set up keyboard shortcut handler for pinned tools.
 * @param {Object} opts
 * @param {() => Array} opts.getTools - Returns current tools array
 * @param {() => Array} opts.getLaunchHistory - Returns current launch history
 * @param {(history: Array) => void} opts.setLaunchHistory - Update launch history
 * @param {(history: Array) => void} opts.saveLaunchHistory - Persist launch history
 * @param {() => void} opts.onLaunch - Called after a launch
 */
export function setupKeyboardShortcuts({ getTools, getLaunchHistory, setLaunchHistory, saveLaunchHistory, onLaunch }) {
  document.addEventListener("keydown", (event) => {
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
      getTools().filter((tool) => tool.pinned && tool.shortcutLabel && tool.shortcutLabel.trim())
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
    const history = recordLaunch(getLaunchHistory(), match.id);
    setLaunchHistory(history);
    saveLaunchHistory(history);
    onLaunch();

    const url = normalizeUrl(match.url);
    if (match.openMode === "same-tab") {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noreferrer");
    }
  });
}

/**
 * Set up arrow-key navigation within the tool grid.
 * @param {HTMLElement} toolGrid - The grid container element
 */
export function setupToolGridKeydown(toolGrid) {
  document.addEventListener("keydown", (event) => {
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

    if (!toolGrid?.contains(active)) return;
    const currentCard = active.classList?.contains("tool-card") ? active : active.closest(".tool-card");
    if (!currentCard) return;

    const cards = [...toolGrid.querySelectorAll(".tool-card")];
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

    const rect = toolGrid.getBoundingClientRect();
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
  });
}
