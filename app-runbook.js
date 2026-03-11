import { renderNav } from "./lib/nav.js";
import {
  loadNotes,
  loadNotesMeta,
  loadRunbookTemplates,
  saveNotesSynced,
  saveRunbookTemplates,
} from "./lib/storage.js";

const MODE_KEY = "central-command.runbook-mode";
const MODE_EDIT = "edit";
const MODE_PREVIEW = "preview";

const elements = {
  notes: document.querySelector("#notes"),
  notesLastEdited: document.querySelector("#notesLastEdited"),
  tabEdit: document.querySelector("#tab-edit"),
  tabPreview: document.querySelector("#tab-preview"),
  editPanel: document.querySelector("#notes-edit-panel"),
  previewPanel: document.querySelector("#notes-preview-panel"),
  previewDiv: document.querySelector("#notes-preview"),
  templatesToggleBtn: document.querySelector("#templatesToggleBtn"),
  templatesPanel: document.querySelector("#templatesPanel"),
  saveAsTemplateBtn: document.querySelector("#saveAsTemplateBtn"),
  templatesList: document.querySelector("#templatesList"),
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
  elements.notes.addEventListener("input", (event) => {
    saveNotesSynced(event.target.value);
    updateLastEditedDisplay();
  });

  elements.templatesToggleBtn?.addEventListener("click", toggleTemplatesPanel);
  elements.saveAsTemplateBtn?.addEventListener("click", saveAsTemplate);
  document.addEventListener("click", (e) => {
    if (elements.templatesPanel && !elements.templatesPanel.contains(e.target) && e.target !== elements.templatesToggleBtn) {
      closeTemplatesPanel();
    }
  });

  updateLastEditedDisplay();
  renderTemplatesList();
}

function toggleTemplatesPanel() {
  const isOpen = !elements.templatesPanel.hidden;
  if (isOpen) {
    closeTemplatesPanel();
  } else {
    elements.templatesPanel.hidden = false;
    elements.templatesToggleBtn?.setAttribute("aria-expanded", "true");
  }
}

function closeTemplatesPanel() {
  elements.templatesPanel.hidden = true;
  elements.templatesToggleBtn?.setAttribute("aria-expanded", "false");
}

function renderTemplatesList() {
  if (!elements.templatesList) return;
  const templates = loadRunbookTemplates();
  elements.templatesList.innerHTML = "";
  if (templates.length === 0) {
    const li = document.createElement("li");
    li.className = "notes-templates-empty";
    li.textContent = "No templates yet. Save your notes to create one.";
    elements.templatesList.appendChild(li);
    return;
  }
  templates.forEach((tpl) => {
    const li = document.createElement("li");
    li.className = "notes-templates-item";
    const name = document.createElement("span");
    name.className = "notes-templates-item__name";
    name.textContent = tpl.name;
    const actions = document.createElement("div");
    actions.className = "notes-templates-item__actions";
    const insertBtn = document.createElement("button");
    insertBtn.type = "button";
    insertBtn.className = "ghost-button";
    insertBtn.textContent = "Insert";
    insertBtn.addEventListener("click", () => insertTemplate(tpl));
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "ghost-button";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteTemplate(tpl.id));
    actions.append(insertBtn, deleteBtn);
    li.append(name, actions);
    elements.templatesList.appendChild(li);
  });
}

function saveAsTemplate() {
  const name = window.prompt("Template name", "My template");
  if (!name || !name.trim()) return;
  const content = elements.notes.value;
  const templates = loadRunbookTemplates();
  const id = crypto.randomUUID();
  templates.push({ id, name: name.trim(), content });
  saveRunbookTemplates(templates);
  renderTemplatesList();
}

function deleteTemplate(id) {
  const templates = loadRunbookTemplates().filter((t) => t.id !== id);
  saveRunbookTemplates(templates);
  renderTemplatesList();
}

function insertTemplate(tpl) {
  const textarea = elements.notes;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const before = text.slice(0, start);
  const after = text.slice(end);
  const inserted = tpl.content + (start === end && before.length > 0 && !before.endsWith("\n") ? "\n" : "");
  textarea.value = before + inserted + after;
  textarea.selectionStart = textarea.selectionEnd = start + inserted.length;
  saveNotesSynced(textarea.value);
  textarea.focus();
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

function formatLastEdited(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec} secs ago`;
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}

function updateLastEditedDisplay() {
  if (!elements.notesLastEdited) return;
  const meta = loadNotesMeta();
  const text = meta?.lastEdited ? formatLastEdited(meta.lastEdited) : null;
  elements.notesLastEdited.textContent = text ? `Last edited: ${text}` : "";
}
