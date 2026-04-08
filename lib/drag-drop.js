/**
 * Native HTML5 Drag and Drop for tool card reordering on the command deck.
 *
 * TODO: Touch device support — HTML5 Drag and Drop does not fire on touch
 * devices (mobile/tablet). To support touch-based reordering, integrate a
 * library such as SortableJS or implement custom touchstart/touchmove/touchend
 * handlers with manual hit-testing.
 */

const DRAG_HANDLE_HTML = `<span class="drag-handle" aria-hidden="true" title="Drag to reorder">⋮⋮</span>`;

let _container = null;
let _onReorder = null;
let _draggedId = null;
let _indicator = null;

/**
 * Initialize drag-and-drop on a container of tool cards.
 *
 * @param {string} containerSelector - CSS selector for the grid container (e.g. "#toolGrid")
 * @param {(toolId: string, newIndex: number) => void} onReorder - Called when a card is dropped
 *   at a new position. `toolId` is the dragged tool's ID, `newIndex` is the target index among
 *   visible cards.
 */
export function initDragDrop(containerSelector, onReorder) {
  _container = document.querySelector(containerSelector);
  _onReorder = onReorder;

  if (!_container) return;

  _container.addEventListener("dragstart", handleDragStart);
  _container.addEventListener("dragover", handleDragOver);
  _container.addEventListener("dragenter", handleDragEnter);
  _container.addEventListener("dragleave", handleDragLeave);
  _container.addEventListener("drop", handleDrop);
  _container.addEventListener("dragend", handleDragEnd);
}

/**
 * Call after re-rendering the grid to make newly-created cards draggable
 * and inject drag handles.
 */
export function applyDragAttributes() {
  if (!_container) return;

  const cards = _container.querySelectorAll(".tool-card");
  cards.forEach((card) => {
    // Only make pinned cards draggable (they have a data-tool-id and are sortable)
    if (!card.dataset.toolId) return;

    card.setAttribute("draggable", "true");

    // Inject drag handle if not already present
    if (!card.querySelector(".drag-handle")) {
      card.insertAdjacentHTML("beforeend", DRAG_HANDLE_HTML);
    }
  });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function handleDragStart(e) {
  const card = e.target.closest(".tool-card[data-tool-id]");
  if (!card) {
    e.preventDefault();
    return;
  }

  _draggedId = card.dataset.toolId;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", _draggedId);

  // Delay adding .dragging so the drag image captures the card un-dimmed
  requestAnimationFrame(() => {
    card.classList.add("dragging");
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  const target = e.target.closest(".tool-card[data-tool-id]");
  if (!target || target.dataset.toolId === _draggedId) {
    removeIndicator();
    return;
  }

  positionIndicator(target, e);
}

function handleDragEnter(e) {
  e.preventDefault();
}

function handleDragLeave(e) {
  // Only remove indicator when leaving the container entirely
  const related = e.relatedTarget;
  if (!_container?.contains(related)) {
    removeIndicator();
  }
}

function handleDrop(e) {
  e.preventDefault();
  const toolId = e.dataTransfer.getData("text/plain");
  if (!toolId || !_onReorder) {
    cleanup();
    return;
  }

  const target = e.target.closest(".tool-card[data-tool-id]");
  if (!target || target.dataset.toolId === toolId) {
    cleanup();
    return;
  }

  const cards = [..._container.querySelectorAll(".tool-card[data-tool-id]")];
  const targetIndex = cards.indexOf(target);

  // Determine whether we are dropping before or after the target card
  const rect = target.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const dropAfter = e.clientY > midY;
  const newIndex = dropAfter ? targetIndex + 1 : targetIndex;

  _onReorder(toolId, newIndex);
  cleanup();
}

function handleDragEnd() {
  cleanup();
}

// ---------------------------------------------------------------------------
// Drop indicator
// ---------------------------------------------------------------------------

function positionIndicator(targetCard, event) {
  if (!_container) return;

  const rect = targetCard.getBoundingClientRect();
  const containerRect = _container.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const before = event.clientY <= midY;

  if (!_indicator) {
    _indicator = document.createElement("div");
    _indicator.className = "drop-indicator";
    _indicator.setAttribute("aria-hidden", "true");
    document.body.appendChild(_indicator);
  }

  const left = rect.left;
  const width = rect.width;
  const top = before ? rect.top - 2 : rect.bottom;

  _indicator.style.position = "fixed";
  _indicator.style.left = `${left}px`;
  _indicator.style.top = `${top}px`;
  _indicator.style.width = `${width}px`;
  _indicator.style.display = "block";
}

function removeIndicator() {
  if (_indicator) {
    _indicator.style.display = "none";
  }
}

function cleanup() {
  // Remove dragging class from all cards
  if (_container) {
    _container.querySelectorAll(".dragging").forEach((el) => el.classList.remove("dragging"));
  }

  removeIndicator();
  if (_indicator && _indicator.parentNode) {
    _indicator.parentNode.removeChild(_indicator);
    _indicator = null;
  }

  _draggedId = null;
}
