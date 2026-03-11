import { renderNav } from "./lib/nav.js";
import { loadNotes, saveNotes } from "./lib/storage.js";

const MODE_KEY = "central-command.runbook-mode";
const MODE_EDIT = "edit";
const MODE_PREVIEW = "preview";

const elements = {
  notes: document.querySelector("#notes"),
  tabEdit: document.querySelector("#tab-edit"),
  tabPreview: document.querySelector("#tab-preview"),
  editPanel: document.querySelector("#notes-edit-panel"),
  previewPanel: document.querySelector("#notes-preview-panel"),
  previewDiv: document.querySelector("#notes-preview"),
};

let mode = MODE_EDIT;

initialize();

function initialize() {
  renderNav("runbook");
  elements.notes.value = loadNotes();

  mode = sessionStorage.getItem(MODE_KEY) || MODE_EDIT;
  applyMode(mode);

  elements.tabEdit.addEventListener("click", () => setMode(MODE_EDIT));
  elements.tabPreview.addEventListener("click", () => setMode(MODE_PREVIEW));
  elements.notes.addEventListener("input", (event) => saveNotes(event.target.value));
}

function setMode(newMode) {
  if (mode === newMode) return;
  mode = newMode;
  sessionStorage.setItem(MODE_KEY, mode);
  applyMode(mode);
}

function applyMode(m) {
  const isEdit = m === MODE_EDIT;
  elements.tabEdit.classList.toggle("is-active", isEdit);
  elements.tabEdit.setAttribute("aria-selected", String(isEdit));
  elements.tabPreview.classList.toggle("is-active", !isEdit);
  elements.tabPreview.setAttribute("aria-selected", String(!isEdit));

  elements.editPanel.hidden = !isEdit;
  elements.previewPanel.hidden = isEdit;

  if (!isEdit) {
    renderPreview();
  }
}

function renderPreview() {
  const text = elements.notes.value.trim();
  if (typeof marked === "undefined") {
    elements.previewDiv.innerHTML = `<p class="notes-preview__fallback">Markdown preview not loaded. Use Edit mode.</p>`;
    return;
  }
  if (!text) {
    elements.previewDiv.innerHTML = '<p class="notes-preview__empty">No notes yet. Switch to Edit to add content.</p>';
    return;
  }
  try {
    elements.previewDiv.innerHTML = marked.parse(text);
  } catch (e) {
    elements.previewDiv.innerHTML = `<p class="notes-preview__fallback">Preview error: ${escapeHtml(String(e.message))}</p>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
