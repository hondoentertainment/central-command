import { renderNav } from "./lib/nav.js";
import { showPromptDialog } from "./lib/confirm-dialog.js";
import {
  loadNotes,
  loadNotesMeta,
  loadRunbookTemplates,
  saveNotesSynced,
  saveRunbookTemplates,
} from "./lib/storage.js";
import { debounce } from "./lib/debounce.js";

const MODE_KEY = "central-command.runbook-mode";
const MODE_EDIT = "edit";
const MODE_PREVIEW = "preview";

const ACTIVE_STATUSES = new Set(["idea", "planning", "in-progress", "review"]);

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
  dailyStandupBtn: document.querySelector("#dailyStandupBtn"),
  projectRefList: document.querySelector("#projectRefList"),
  projectRefPanel: document.querySelector("#projectRefPanel"),
};

let mode = MODE_EDIT;

const debouncedSaveNotes = debounce((value) => saveNotesSynced(value), 800);

initialize();

function initialize() {
  renderNav("runbook");
  elements.notes.value = loadNotes();

  mode = sessionStorage.getItem(MODE_KEY) || MODE_EDIT;
  applyMode(mode);

  elements.tabEdit.addEventListener("click", () => setMode(MODE_EDIT));
  elements.tabPreview.addEventListener("click", () => setMode(MODE_PREVIEW));
  elements.notes.addEventListener("input", (event) => {
    debouncedSaveNotes(event.target.value);
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

  elements.dailyStandupBtn?.addEventListener("click", insertDailyStandup);
  renderProjectRefPanel();
  setupMentionSupport();
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

async function saveAsTemplate() {
  const name = await showPromptDialog({
    title: "Save as template",
    message: "Give this template a name so you can reuse it later.",
    placeholder: "Template name",
    defaultValue: "My template",
    confirmLabel: "Save",
  });
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

function sanitizeHtml(html) {
  const ALLOWED_TAGS = new Set([
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "em", "strong", "del", "a", "img", "table", "thead",
    "tbody", "tr", "th", "td", "input", "span", "div", "sup", "sub",
  ]);
  const ALLOWED_ATTRS = new Set([
    "href", "src", "alt", "title", "class", "id",
    "type", "checked", "disabled", "align",
  ]);
  const div = document.createElement("div");
  div.innerHTML = html;
  function walk(node) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) {
          child.replaceWith(...child.childNodes);
          continue;
        }
        for (const attr of [...child.attributes]) {
          if (!ALLOWED_ATTRS.has(attr.name)) {
            child.removeAttribute(attr.name);
          } else if (attr.name === "href" || attr.name === "src") {
            const val = attr.value.trim().toLowerCase();
            if (val.startsWith("javascript:") || val.startsWith("data:text/html")) {
              child.removeAttribute(attr.name);
            }
          }
        }
        if (tag === "a") {
          child.setAttribute("rel", "noopener noreferrer");
        }
        walk(child);
      }
    }
  }
  walk(div);
  return div.innerHTML;
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
    const rawHtml = marked.parse(text);
    elements.previewDiv.innerHTML = sanitizeHtml(rawHtml);
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

/* --- Project linking helpers --- */

function loadActiveProjects() {
  try {
    const raw = localStorage.getItem("central-command.projects");
    const projects = raw ? JSON.parse(raw) : [];
    return projects.filter((p) => ACTIVE_STATUSES.has(p.status));
  } catch {
    return [];
  }
}

function insertTextAtCursor(text) {
  const textarea = elements.notes;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + text + after;
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  saveNotesSynced(textarea.value);
  textarea.focus();
}

/* Daily standup template */

function insertDailyStandup() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const activeProjects = loadActiveProjects();
  const projectLines =
    activeProjects.length > 0
      ? activeProjects
          .map((p) => `- **${p.name}** (${p.status})${p.description ? " — " + p.description : ""}`)
          .join("\n")
      : "- _No active projects_";

  const template = `## Daily Standup — ${today}

### What I did yesterday
-

### What I'm doing today
-

### Blockers
-

### Active Projects
${projectLines}
`;

  const textarea = elements.notes;
  if (!textarea) return;
  const start = textarea.selectionStart;
  if (start === 0 && textarea.selectionEnd === 0) {
    // Prepend
    textarea.value = template + "\n" + textarea.value;
    textarea.selectionStart = textarea.selectionEnd = template.length;
  } else {
    insertTextAtCursor(template);
  }
  saveNotesSynced(textarea.value);
  textarea.focus();
}

/* Project reference chip panel */

function renderProjectRefPanel() {
  const list = elements.projectRefList;
  if (!list) return;
  const projects = loadActiveProjects();
  list.innerHTML = "";
  if (projects.length === 0) {
    list.innerHTML = '<span style="font-size:0.8rem;color:var(--muted)">No active projects</span>';
    return;
  }
  projects.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "runbook-project-ref";
    btn.innerHTML = `${escapeHtml(p.name)} <span class="runbook-project-ref__status">${escapeHtml(p.status)}</span>`;
    btn.addEventListener("click", () => {
      insertTextAtCursor(`**${p.name}**`);
    });
    list.appendChild(btn);
  });
}

/* @mention autocomplete */

let mentionDropdown = null;
let mentionStartIndex = -1;
let mentionActiveIndex = 0;

function setupMentionSupport() {
  const textarea = elements.notes;
  if (!textarea) return;

  textarea.addEventListener("input", handleMentionInput);
  textarea.addEventListener("keydown", handleMentionKeydown);
  textarea.addEventListener("blur", () => {
    // Delay so click on dropdown registers first
    setTimeout(closeMentionDropdown, 150);
  });
}

function handleMentionInput() {
  const textarea = elements.notes;
  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.slice(0, cursorPos);

  // Find the last @ that starts a mention (preceded by start-of-text or whitespace)
  const mentionMatch = textBefore.match(/(^|[\s])@([^\s]*)$/);
  if (!mentionMatch) {
    closeMentionDropdown();
    return;
  }

  const query = mentionMatch[2].toLowerCase();
  mentionStartIndex = cursorPos - mentionMatch[2].length - 1; // position of @

  const projects = loadActiveProjects();
  const filtered = projects.filter((p) => p.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    closeMentionDropdown();
    return;
  }

  mentionActiveIndex = 0;
  showMentionDropdown(filtered);
}

function handleMentionKeydown(e) {
  if (!mentionDropdown) return;
  const options = mentionDropdown.querySelectorAll(".runbook-mention-option");
  if (options.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    mentionActiveIndex = (mentionActiveIndex + 1) % options.length;
    updateMentionActive(options);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    mentionActiveIndex = (mentionActiveIndex - 1 + options.length) % options.length;
    updateMentionActive(options);
  } else if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    const active = options[mentionActiveIndex];
    if (active) selectMention(active.dataset.name);
  } else if (e.key === "Escape") {
    e.preventDefault();
    closeMentionDropdown();
  }
}

function updateMentionActive(options) {
  options.forEach((opt, i) => {
    opt.classList.toggle("is-active", i === mentionActiveIndex);
  });
}

function showMentionDropdown(projects) {
  closeMentionDropdown();
  const textarea = elements.notes;
  const rect = textarea.getBoundingClientRect();

  mentionDropdown = document.createElement("div");
  mentionDropdown.className = "runbook-mention-dropdown";
  mentionDropdown.style.left = `${rect.left + 16}px`;
  mentionDropdown.style.top = `${rect.top + rect.height - 220}px`;

  projects.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "runbook-mention-option" + (i === 0 ? " is-active" : "");
    btn.textContent = `${p.name} (${p.status})`;
    btn.dataset.name = p.name;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault(); // Prevent blur
      selectMention(p.name);
    });
    mentionDropdown.appendChild(btn);
  });

  document.body.appendChild(mentionDropdown);
}

function selectMention(name) {
  const textarea = elements.notes;
  const cursorPos = textarea.selectionStart;
  const before = textarea.value.slice(0, mentionStartIndex);
  const after = textarea.value.slice(cursorPos);
  const insert = `**${name}**`;
  textarea.value = before + insert + after;
  textarea.selectionStart = textarea.selectionEnd = before.length + insert.length;
  saveNotesSynced(textarea.value);
  textarea.focus();
  closeMentionDropdown();
}

function closeMentionDropdown() {
  if (mentionDropdown) {
    mentionDropdown.remove();
    mentionDropdown = null;
  }
  mentionStartIndex = -1;
  mentionActiveIndex = 0;
}
