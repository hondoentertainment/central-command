/**
 * Field-level merge and conflict resolution for cloud sync.
 * Replaces simple last-write-wins with per-field comparison and interactive UI.
 */

import { showToast } from "./toast.js";

// ---------------------------------------------------------------------------
// Sync activity log
// ---------------------------------------------------------------------------

const SYNC_LOG_KEY = "central-command.sync-log";
const MAX_SYNC_LOG = 50;

/**
 * Log a sync activity event to localStorage.
 * @param {string} action - Short action identifier (e.g. "sync_merge", "conflict_resolved")
 * @param {Object} [details={}] - Additional context
 */
export function logSyncActivity(action, details = {}) {
  try {
    const raw = localStorage.getItem(SYNC_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      action,
      details,
      at: new Date().toISOString(),
    });
    localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(log.slice(0, MAX_SYNC_LOG)));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Read the sync activity log from localStorage.
 * @param {number} [limit=50] - Max entries to return
 * @returns {Array<{id: string, action: string, details: Object, at: string}>}
 */
export function loadSyncLog(limit = MAX_SYNC_LOG) {
  try {
    const raw = localStorage.getItem(SYNC_LOG_KEY);
    if (!raw) return [];
    const log = JSON.parse(raw);
    return Array.isArray(log) ? log.slice(0, limit) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Field-level merge
// ---------------------------------------------------------------------------

/** Fields compared during field-level merge */
const MERGE_FIELDS = [
  "name",
  "url",
  "category",
  "description",
  "accent",
  "pinned",
  "pinRank",
  "surfaces",
  "iconKey",
  "shortcutLabel",
  "openMode",
];

/**
 * Deep-equal comparison for merge field values.
 */
function fieldsEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return false;
}

/**
 * Perform field-level merge of local and cloud tool arrays.
 * For tools present in both: keep the most recently updated field.
 * Tools only in local: keep as-is.
 * Tools only in cloud: add to local.
 *
 * @param {Array} localTools - Current local tool array
 * @param {Array} cloudTools - Cloud tool array (from Firestore)
 * @returns {{ merged: Array, conflicts: Array, stats: {added: number, updated: number, conflicted: number} }}
 */
export function mergeTools(localTools, cloudTools) {
  const localMap = new Map();
  (localTools || []).forEach((t) => { if (t?.id) localMap.set(t.id, t); });

  const cloudMap = new Map();
  (cloudTools || []).forEach((t) => { if (t?.id) cloudMap.set(t.id, t); });

  const merged = [];
  const conflicts = [];
  let added = 0;
  let updated = 0;

  // Process all IDs from both sides
  const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);

  for (const id of allIds) {
    const local = localMap.get(id);
    const cloud = cloudMap.get(id);

    // Only in local
    if (local && !cloud) {
      merged.push({ ...local });
      continue;
    }

    // Only in cloud
    if (!local && cloud) {
      merged.push({ ...cloud });
      added++;
      continue;
    }

    // In both — field-level merge
    const localTs = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
    const cloudTs = cloud.updatedAt ? new Date(cloud.updatedAt).getTime() : 0;

    const mergedTool = { ...local };
    let hadUpdate = false;
    const toolConflicts = [];

    for (const field of MERGE_FIELDS) {
      const localVal = local[field];
      const cloudVal = cloud[field];

      // If values are the same, skip
      if (fieldsEqual(localVal, cloudVal)) continue;

      // If only one side changed from some baseline, take the changed one.
      // Since we only have updatedAt at tool level (not per-field), we use
      // the tool-level timestamp to determine which side is newer.
      if (cloudTs > localTs) {
        // Cloud is newer overall — prefer cloud field
        mergedTool[field] = cloudVal;
        hadUpdate = true;
      } else if (localTs > cloudTs) {
        // Local is newer — keep local field (already in mergedTool)
        hadUpdate = true;
      } else {
        // Same timestamp but different values — true conflict
        toolConflicts.push({
          field,
          localValue: localVal,
          cloudValue: cloudVal,
        });
      }
    }

    // Preserve the latest updatedAt
    mergedTool.updatedAt = cloudTs > localTs ? cloud.updatedAt : local.updatedAt;

    if (toolConflicts.length > 0) {
      conflicts.push({
        toolId: id,
        toolName: local.name || cloud.name,
        fields: toolConflicts,
        local,
        cloud,
      });
    }

    if (hadUpdate) updated++;
    merged.push(mergedTool);
  }

  return {
    merged,
    conflicts,
    stats: {
      added,
      updated,
      conflicted: conflicts.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Conflict resolution UI
// ---------------------------------------------------------------------------

/**
 * Show a dialog for resolving field-level conflicts.
 * @param {Array} conflicts - Array of { toolId, toolName, fields: [{field, localValue, cloudValue}], local, cloud }
 * @returns {Promise<Array>} Resolved tools (with user-chosen values applied)
 */
export function showConflictDialog(conflicts) {
  if (!conflicts || conflicts.length === 0) return Promise.resolve([]);

  ensureConflictStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "conflict-dialog__overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Resolve sync conflicts");

    const dialog = document.createElement("div");
    dialog.className = "conflict-dialog";

    // Header
    const header = document.createElement("div");
    header.className = "conflict-dialog__header";
    const title = document.createElement("h2");
    title.className = "conflict-dialog__title";
    title.textContent = "Sync Conflicts";
    const subtitle = document.createElement("p");
    subtitle.className = "conflict-dialog__subtitle";
    subtitle.textContent = `${conflicts.length} tool${conflicts.length > 1 ? "s" : ""} changed on both devices. Choose which version to keep.`;
    header.append(title, subtitle);

    // Conflict entries
    const body = document.createElement("div");
    body.className = "conflict-dialog__body";

    const resolutions = new Map();

    conflicts.forEach((conflict) => {
      const section = document.createElement("div");
      section.className = "conflict-dialog__tool-section";

      const toolTitle = document.createElement("h3");
      toolTitle.className = "conflict-dialog__tool-name";
      toolTitle.textContent = conflict.toolName;
      section.appendChild(toolTitle);

      // Quick actions for the whole tool
      const quickRow = document.createElement("div");
      quickRow.className = "conflict-dialog__quick-actions";

      const keepLocalAll = document.createElement("button");
      keepLocalAll.type = "button";
      keepLocalAll.className = "conflict-dialog__quick-btn";
      keepLocalAll.textContent = "Keep all local";
      const keepCloudAll = document.createElement("button");
      keepCloudAll.type = "button";
      keepCloudAll.className = "conflict-dialog__quick-btn";
      keepCloudAll.textContent = "Keep all cloud";

      quickRow.append(keepLocalAll, keepCloudAll);
      section.appendChild(quickRow);

      const fieldResolutions = new Map();

      conflict.fields.forEach((f) => {
        const row = document.createElement("div");
        row.className = "conflict-dialog__field-row";

        const label = document.createElement("span");
        label.className = "conflict-dialog__field-label";
        label.textContent = f.field;

        const diff = document.createElement("div");
        diff.className = "conflict-dialog__diff";

        const localSide = document.createElement("button");
        localSide.type = "button";
        localSide.className = "conflict-dialog__diff-option conflict-dialog__diff-option--selected";
        localSide.innerHTML = `<span class="conflict-dialog__diff-label">Local</span><span class="conflict-dialog__diff-value">${formatValue(f.localValue)}</span>`;

        const cloudSide = document.createElement("button");
        cloudSide.type = "button";
        cloudSide.className = "conflict-dialog__diff-option";
        cloudSide.innerHTML = `<span class="conflict-dialog__diff-label">Cloud</span><span class="conflict-dialog__diff-value">${formatValue(f.cloudValue)}</span>`;

        // Default to local
        fieldResolutions.set(f.field, "local");

        localSide.addEventListener("click", () => {
          fieldResolutions.set(f.field, "local");
          localSide.classList.add("conflict-dialog__diff-option--selected");
          cloudSide.classList.remove("conflict-dialog__diff-option--selected");
        });

        cloudSide.addEventListener("click", () => {
          fieldResolutions.set(f.field, "cloud");
          cloudSide.classList.add("conflict-dialog__diff-option--selected");
          localSide.classList.remove("conflict-dialog__diff-option--selected");
        });

        diff.append(localSide, cloudSide);
        row.append(label, diff);
        section.appendChild(row);
      });

      keepLocalAll.addEventListener("click", () => {
        conflict.fields.forEach((f) => fieldResolutions.set(f.field, "local"));
        section.querySelectorAll(".conflict-dialog__diff-option").forEach((el) => {
          const isLocal = el.querySelector(".conflict-dialog__diff-label")?.textContent === "Local";
          el.classList.toggle("conflict-dialog__diff-option--selected", isLocal);
        });
      });

      keepCloudAll.addEventListener("click", () => {
        conflict.fields.forEach((f) => fieldResolutions.set(f.field, "cloud"));
        section.querySelectorAll(".conflict-dialog__diff-option").forEach((el) => {
          const isCloud = el.querySelector(".conflict-dialog__diff-label")?.textContent === "Cloud";
          el.classList.toggle("conflict-dialog__diff-option--selected", isCloud);
        });
      });

      resolutions.set(conflict.toolId, { conflict, fieldResolutions });
      body.appendChild(section);
    });

    // Actions
    const actions = document.createElement("div");
    actions.className = "conflict-dialog__actions";
    const resolveBtn = document.createElement("button");
    resolveBtn.type = "button";
    resolveBtn.className = "cd-btn cd-btn--primary";
    resolveBtn.textContent = "Resolve conflicts";

    actions.appendChild(resolveBtn);

    dialog.append(header, body, actions);
    overlay.appendChild(dialog);

    resolveBtn.addEventListener("click", () => {
      const resolvedTools = [];
      for (const [toolId, { conflict, fieldResolutions }] of resolutions) {
        const resolved = { ...conflict.local };
        for (const [field, choice] of fieldResolutions) {
          if (choice === "cloud") {
            const cloudField = conflict.fields.find((f) => f.field === field);
            if (cloudField) resolved[field] = cloudField.cloudValue;
          }
        }
        resolved.updatedAt = new Date().toISOString();
        resolvedTools.push(resolved);
      }
      logSyncActivity("conflicts_resolved", {
        count: conflicts.length,
        tools: conflicts.map((c) => c.toolName),
      });
      dismiss(resolvedTools);
    });

    function dismiss(value) {
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 150ms";
      setTimeout(() => {
        overlay.remove();
        resolve(value);
      }, 160);
    }

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) dismiss([]);
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") dismiss([]);
    });

    document.body.appendChild(overlay);
    resolveBtn.focus();
  });
}

function formatValue(value) {
  if (value === null || value === undefined) return '<em>none</em>';
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length === 0 ? '<em>none</em>' : value.join(", ");
  const str = String(value);
  return str.length > 40 ? escapeHtml(str.slice(0, 37)) + "..." : escapeHtml(str);
}

function escapeHtml(text) {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

// ---------------------------------------------------------------------------
// Sync summary toast
// ---------------------------------------------------------------------------

/**
 * Show a toast summarizing sync results.
 * @param {{ added: number, updated: number, conflicted: number }} stats
 */
export function showSyncSummaryToast(stats) {
  const parts = [];
  if (stats.added > 0) parts.push(`${stats.added} added`);
  if (stats.updated > 0) parts.push(`${stats.updated} updated`);
  if (stats.conflicted > 0) parts.push(`${stats.conflicted} conflict${stats.conflicted > 1 ? "s" : ""} resolved`);

  if (parts.length === 0) return;

  const message = `Synced: ${parts.join(", ")}.`;
  logSyncActivity("sync_complete", stats);
  showToast(message, "success");
}

// ---------------------------------------------------------------------------
// Style injection
// ---------------------------------------------------------------------------

function ensureConflictStyles() {
  if (document.querySelector("#conflict-dialog-styles")) return;
  const s = document.createElement("style");
  s.id = "conflict-dialog-styles";
  s.textContent = `
    .conflict-dialog__overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      animation: cd-overlay-in 200ms ease forwards;
    }
    .conflict-dialog {
      position: relative;
      width: 100%;
      max-width: 600px;
      max-height: 80vh;
      margin: 16px;
      padding: 28px;
      border-radius: 18px;
      background: rgba(12, 20, 36, 0.96);
      backdrop-filter: blur(16px) saturate(1.4);
      -webkit-backdrop-filter: blur(16px) saturate(1.4);
      border: 1px solid rgba(163, 191, 250, 0.15);
      box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3),
                  inset 0 1px 0 rgba(255,255,255,0.06);
      color: #edf4ff;
      font-family: var(--font-sans, "DM Sans", system-ui, sans-serif);
      display: flex;
      flex-direction: column;
      animation: cd-dialog-in 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .conflict-dialog__header {
      margin-bottom: 20px;
    }
    .conflict-dialog__title {
      margin: 0 0 4px;
      font-size: 1.15rem;
      font-weight: 600;
    }
    .conflict-dialog__subtitle {
      margin: 0;
      font-size: 0.82rem;
      color: #8a9bba;
    }
    .conflict-dialog__body {
      flex: 1;
      overflow-y: auto;
      max-height: 50vh;
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-bottom: 20px;
      padding-right: 4px;
    }
    .conflict-dialog__body::-webkit-scrollbar {
      width: 4px;
    }
    .conflict-dialog__body::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
    }
    .conflict-dialog__tool-section {
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 16px;
      background: rgba(255,255,255,0.02);
    }
    .conflict-dialog__tool-name {
      margin: 0 0 10px;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--teal, #3eb4a5);
    }
    .conflict-dialog__quick-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .conflict-dialog__quick-btn {
      background: none;
      border: 1px solid rgba(163, 191, 250, 0.15);
      color: #8a9bba;
      font-size: 0.75rem;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 140ms, color 140ms;
    }
    .conflict-dialog__quick-btn:hover {
      background: rgba(255,255,255,0.06);
      color: #edf4ff;
    }
    .conflict-dialog__field-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
    }
    .conflict-dialog__field-label {
      min-width: 90px;
      font-size: 0.78rem;
      font-weight: 500;
      color: #8a9bba;
      padding-top: 8px;
      text-transform: capitalize;
    }
    .conflict-dialog__diff {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .conflict-dialog__diff-option {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.02);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      color: inherit;
      transition: border-color 140ms, background 140ms;
    }
    .conflict-dialog__diff-option:hover {
      background: rgba(255,255,255,0.05);
    }
    .conflict-dialog__diff-option--selected {
      border-color: var(--teal, #3eb4a5);
      background: rgba(62, 180, 165, 0.08);
    }
    .conflict-dialog__diff-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #667a94;
    }
    .conflict-dialog__diff-option--selected .conflict-dialog__diff-label {
      color: var(--teal, #3eb4a5);
    }
    .conflict-dialog__diff-value {
      font-size: 0.82rem;
      word-break: break-word;
    }
    .conflict-dialog__diff-value em {
      color: #667a94;
      font-style: italic;
    }
    .conflict-dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    /* Sync log styles */
    .sync-log {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sync-log__item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--surface-subtle);
      font-size: 0.82rem;
    }
    .sync-log__action {
      font-weight: 500;
      color: var(--text);
      text-transform: capitalize;
    }
    .sync-log__details {
      font-size: 0.78rem;
      color: var(--muted);
    }
    .sync-log__time {
      font-size: 0.75rem;
      color: var(--muted);
      white-space: nowrap;
    }
    .sync-log__empty {
      padding: 16px;
      color: var(--muted);
      font-size: 0.85rem;
      text-align: center;
    }

    /* Light theme overrides */
    html.theme-light .conflict-dialog {
      background: rgba(255, 255, 255, 0.97);
      border-color: rgba(0, 0, 0, 0.1);
      color: var(--text);
    }
    html.theme-light .conflict-dialog__subtitle,
    html.theme-light .conflict-dialog__field-label,
    html.theme-light .conflict-dialog__diff-label {
      color: var(--muted);
    }
    html.theme-light .conflict-dialog__tool-section {
      border-color: var(--line);
      background: var(--surface-subtle);
    }
    html.theme-light .conflict-dialog__diff-option {
      border-color: var(--line);
      background: transparent;
    }
    html.theme-light .conflict-dialog__diff-option:hover {
      background: var(--surface-hover);
    }
    html.theme-light .conflict-dialog__diff-option--selected {
      border-color: var(--teal);
      background: rgba(62, 180, 165, 0.06);
    }
    html.theme-light .conflict-dialog__quick-btn {
      border-color: var(--line);
      color: var(--muted);
    }
    html.theme-light .conflict-dialog__quick-btn:hover {
      background: var(--surface-hover);
      color: var(--text);
    }
  `;
  document.head.appendChild(s);
}
