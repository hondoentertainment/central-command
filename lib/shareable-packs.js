/**
 * Shareable tool packs — export/import tools via URL-safe encoded links.
 * Provides pack export, URL-based import with preview modal, and full setup sharing.
 */

import { showToast } from "./toast.js";

const BASE_URL = "https://hondoentertainment.github.io/central-command/";
const PACK_PARAM = "pack";
const PACK_VERSION = 1;

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function encodePackData(data) {
  try {
    const json = JSON.stringify(data);
    return globalThis.btoa(unescape(encodeURIComponent(json)));
  } catch {
    return null;
  }
}

function decodePackData(encoded) {
  try {
    const json = decodeURIComponent(escape(globalThis.atob(encoded)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Export pack as URL
// ---------------------------------------------------------------------------

/**
 * Generate a shareable URL containing the given tools as a pack.
 * Copies the URL to clipboard and shows a toast.
 * @param {Array} tools - Array of tool objects to share
 * @param {string} packName - Human-readable name for the pack
 * @param {string} [author] - Optional author name
 * @returns {Promise<string|null>} The generated URL, or null on failure
 */
export async function exportPackAsUrl(tools, packName, author) {
  if (!Array.isArray(tools) || tools.length === 0) {
    showToast("No tools to share.", "error");
    return null;
  }

  const packData = {
    version: PACK_VERSION,
    name: packName || "Shared Pack",
    author: author || undefined,
    toolCount: tools.length,
    createdAt: new Date().toISOString(),
    tools: tools.map((t) => ({
      id: t.id,
      name: t.name,
      url: t.url,
      category: t.category,
      description: t.description,
      accent: t.accent,
      pinned: t.pinned,
      pinRank: t.pinRank,
      surfaces: t.surfaces,
      iconKey: t.iconKey,
      shortcutLabel: t.shortcutLabel,
      openMode: t.openMode,
    })),
  };

  const encoded = encodePackData(packData);
  if (!encoded) {
    showToast("Failed to encode pack data.", "error");
    return null;
  }

  const shareUrl = `${BASE_URL}?${PACK_PARAM}=${encoded}`;

  if (encoded.length > 8000) {
    showToast("Pack is too large for a shareable URL. Try sharing fewer tools.", "error");
    return null;
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast(`Pack link copied — "${packName}" (${tools.length} tools).`, "success");
  } catch {
    showToast("Could not copy link to clipboard.", "error");
  }

  return shareUrl;
}

// ---------------------------------------------------------------------------
// Import pack from URL
// ---------------------------------------------------------------------------

/**
 * Check the current URL for a ?pack= parameter. If found, decode the pack data,
 * show a preview modal, let the user select tools, and return the selected tools.
 * Cleans the URL after processing.
 * @returns {Promise<{tools: Array, packName: string}|null>} Selected tools or null
 */
export async function importPackFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const packParam = params.get(PACK_PARAM);
  if (!packParam) return null;

  const data = decodePackData(packParam);
  if (!data || !Array.isArray(data.tools) || data.tools.length === 0) {
    showToast("Could not decode pack. The link may be corrupted.", "error");
    cleanPackUrl();
    return null;
  }

  const result = await showPackPreviewModal(data);
  cleanPackUrl();
  return result;
}

/**
 * Remove the ?pack= parameter from the URL without reloading.
 */
function cleanPackUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(PACK_PARAM);
  const cleaned = url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + url.hash;
  history.replaceState(null, "", cleaned);
}

// ---------------------------------------------------------------------------
// Pack preview modal
// ---------------------------------------------------------------------------

function showPackPreviewModal(packData) {
  return new Promise((resolve) => {
    ensurePackStyles();

    const overlay = document.createElement("div");
    overlay.className = "pack-preview-modal__overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", `Import pack: ${packData.name}`);

    const dialog = document.createElement("div");
    dialog.className = "pack-preview-modal";

    // Header
    const header = document.createElement("div");
    header.className = "pack-preview-modal__header";
    const title = document.createElement("h2");
    title.className = "pack-preview-modal__title";
    title.textContent = `Import "${packData.name}"?`;
    const meta = document.createElement("p");
    meta.className = "pack-preview-modal__meta";
    const parts = [`${packData.tools.length} tools`];
    if (packData.author) parts.push(`by ${packData.author}`);
    if (packData.createdAt) {
      const d = new Date(packData.createdAt);
      if (!Number.isNaN(d.getTime())) parts.push(d.toLocaleDateString());
    }
    meta.textContent = parts.join(" \u00b7 ");
    header.append(title, meta);

    // Tool list with checkboxes
    const list = document.createElement("div");
    list.className = "pack-preview-modal__list";
    const checkboxes = [];

    packData.tools.forEach((tool, i) => {
      const row = document.createElement("label");
      row.className = "pack-preview-modal__tool";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.dataset.index = i;
      checkboxes.push(cb);

      const info = document.createElement("div");
      info.className = "pack-preview-modal__tool-info";
      const name = document.createElement("strong");
      name.textContent = tool.name;
      const desc = document.createElement("span");
      desc.textContent = `${tool.category} — ${tool.description || tool.url}`;
      info.append(name, desc);

      row.append(cb, info);
      list.appendChild(row);
    });

    // Select all / none
    const selectRow = document.createElement("div");
    selectRow.className = "pack-preview-modal__select-row";
    const selectAllBtn = document.createElement("button");
    selectAllBtn.type = "button";
    selectAllBtn.className = "pack-preview-modal__select-btn";
    selectAllBtn.textContent = "Select all";
    selectAllBtn.addEventListener("click", () => checkboxes.forEach((cb) => { cb.checked = true; }));
    const selectNoneBtn = document.createElement("button");
    selectNoneBtn.type = "button";
    selectNoneBtn.className = "pack-preview-modal__select-btn";
    selectNoneBtn.textContent = "Select none";
    selectNoneBtn.addEventListener("click", () => checkboxes.forEach((cb) => { cb.checked = false; }));
    selectRow.append(selectAllBtn, selectNoneBtn);

    // Actions
    const actions = document.createElement("div");
    actions.className = "pack-preview-modal__actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "cd-btn cd-btn--ghost";
    cancelBtn.textContent = "Cancel";
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "cd-btn cd-btn--primary";
    importBtn.textContent = "Import selected";

    actions.append(cancelBtn, importBtn);

    dialog.append(header, selectRow, list, actions);
    overlay.appendChild(dialog);

    function dismiss(value) {
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 150ms";
      setTimeout(() => {
        overlay.remove();
        resolve(value);
      }, 160);
    }

    cancelBtn.addEventListener("click", () => dismiss(null));
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) dismiss(null);
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") dismiss(null);
    });

    importBtn.addEventListener("click", () => {
      const selected = checkboxes
        .filter((cb) => cb.checked)
        .map((cb) => packData.tools[Number(cb.dataset.index)]);
      if (selected.length === 0) {
        showToast("No tools selected.", "info");
        return;
      }
      dismiss({ tools: selected, packName: packData.name });
    });

    document.body.appendChild(overlay);
    importBtn.focus();
  });
}

// ---------------------------------------------------------------------------
// Share full setup
// ---------------------------------------------------------------------------

/**
 * Export ALL tools as a shareable pack URL (read-only snapshot).
 * @param {Array} tools - Full tool array from state
 * @param {string} [setupName] - Optional name (defaults to "My Setup")
 * @returns {Promise<string|null>} The generated URL
 */
export async function exportFullSetup(tools, setupName) {
  return exportPackAsUrl(tools, setupName || "My Setup");
}

// ---------------------------------------------------------------------------
// Style injection
// ---------------------------------------------------------------------------

function ensurePackStyles() {
  if (document.querySelector("#pack-preview-styles")) return;
  const s = document.createElement("style");
  s.id = "pack-preview-styles";
  s.textContent = `
    .pack-preview-modal__overlay {
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
    .pack-preview-modal {
      position: relative;
      width: 100%;
      max-width: 520px;
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
    .pack-preview-modal__header {
      margin-bottom: 16px;
    }
    .pack-preview-modal__title {
      margin: 0 0 4px;
      font-size: 1.15rem;
      font-weight: 600;
    }
    .pack-preview-modal__meta {
      margin: 0;
      font-size: 0.82rem;
      color: #8a9bba;
    }
    .pack-preview-modal__select-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .pack-preview-modal__select-btn {
      background: none;
      border: none;
      color: var(--teal, #3eb4a5);
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: background 140ms;
    }
    .pack-preview-modal__select-btn:hover {
      background: rgba(62, 180, 165, 0.12);
    }
    .pack-preview-modal__list {
      flex: 1;
      overflow-y: auto;
      max-height: 340px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 20px;
      padding-right: 4px;
    }
    .pack-preview-modal__list::-webkit-scrollbar {
      width: 4px;
    }
    .pack-preview-modal__list::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
    }
    .pack-preview-modal__tool {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.06);
      background: rgba(255,255,255,0.03);
      cursor: pointer;
      transition: background 140ms;
    }
    .pack-preview-modal__tool:hover {
      background: rgba(255,255,255,0.06);
    }
    .pack-preview-modal__tool input[type="checkbox"] {
      margin-top: 3px;
      accent-color: var(--teal, #3eb4a5);
    }
    .pack-preview-modal__tool-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .pack-preview-modal__tool-info strong {
      font-size: 0.88rem;
      font-weight: 600;
    }
    .pack-preview-modal__tool-info span {
      font-size: 0.78rem;
      color: #8a9bba;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pack-preview-modal__actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    /* Light theme overrides */
    html.theme-light .pack-preview-modal {
      background: rgba(255, 255, 255, 0.97);
      border-color: rgba(0, 0, 0, 0.1);
      color: var(--text);
    }
    html.theme-light .pack-preview-modal__meta,
    html.theme-light .pack-preview-modal__tool-info span {
      color: var(--muted);
    }
    html.theme-light .pack-preview-modal__tool {
      border-color: var(--line);
      background: var(--surface-subtle);
    }
    html.theme-light .pack-preview-modal__tool:hover {
      background: var(--surface-hover);
    }
  `;
  document.head.appendChild(s);
}
