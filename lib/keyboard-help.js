/**
 * Keyboard shortcut help overlay.
 * Press "?" to toggle a modal listing every shortcut in Central Command.
 */

let overlayEl = null;
let isOpen = false;

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const SHORTCUTS = [
  { keys: [isMac ? "Cmd+K" : "Ctrl+K"], desc: "Open command palette" },
  { keys: ["/"], desc: "Focus search" },
  { keys: ["Esc"], desc: "Close dialogs / Exit select mode" },
  { keys: ["\u2190 \u2191 \u2192 \u2193"], desc: "Navigate tool grid" },
  { keys: ["Enter"], desc: "Launch focused tool" },
  { keys: [isMac ? "Cmd+Letter" : "Ctrl+Letter"], desc: "Launch pinned tool (configurable in settings)" },
  { keys: ["?"], desc: "Toggle this help" },
];

export function initKeyboardHelp() {
  if (typeof document === "undefined") return;

  ensureStyles();

  document.addEventListener("keydown", (e) => {
    if (e.key === "?" && !isInputFocused()) {
      e.preventDefault();
      toggle();
    }
    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      close();
    }
  });
}

function isInputFocused() {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function toggle() {
  isOpen ? close() : open();
}

function open() {
  if (isOpen) return;
  isOpen = true;

  overlayEl = document.createElement("div");
  overlayEl.className = "kb-help-overlay";
  overlayEl.setAttribute("role", "dialog");
  overlayEl.setAttribute("aria-label", "Keyboard shortcuts");
  overlayEl.innerHTML = `
    <div class="kb-help-panel">
      <header class="kb-help-header">
        <h2 class="kb-help-title">Keyboard Shortcuts</h2>
        <button type="button" class="kb-help-close" aria-label="Close">\u00d7</button>
      </header>
      <ul class="kb-help-list">
        ${SHORTCUTS.map(
          (s) => `
          <li class="kb-help-row">
            <span class="kb-help-keys">${s.keys.map((k) => `<kbd>${k}</kbd>`).join(" / ")}</span>
            <span class="kb-help-desc">${s.desc}</span>
          </li>`
        ).join("")}
      </ul>
    </div>
  `;

  overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) close();
  });
  overlayEl.querySelector(".kb-help-close").addEventListener("click", close);

  document.body.appendChild(overlayEl);

  requestAnimationFrame(() => {
    overlayEl.querySelector(".kb-help-close")?.focus();
  });
}

function close() {
  if (!isOpen || !overlayEl) return;
  isOpen = false;
  overlayEl.classList.add("kb-help-overlay--out");
  overlayEl.addEventListener("animationend", () => overlayEl.remove(), { once: true });
  // Fallback if animation is disabled
  setTimeout(() => { if (overlayEl?.parentNode) overlayEl.remove(); }, 300);
  overlayEl = null;
}

function ensureStyles() {
  if (document.querySelector("#keyboard-help-styles")) return;
  const s = document.createElement("style");
  s.id = "keyboard-help-styles";
  s.textContent = `
    .kb-help-overlay {
      position: fixed;
      inset: 0;
      z-index: 1800;
      display: grid;
      place-items: center;
      background: rgba(3, 6, 10, 0.65);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      animation: kb-help-overlay-in 200ms ease both;
    }
    .kb-help-overlay--out {
      animation: kb-help-overlay-out 150ms ease both;
    }
    @keyframes kb-help-overlay-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes kb-help-overlay-out {
      from { opacity: 1; }
      to   { opacity: 0; }
    }

    .kb-help-panel {
      width: min(480px, calc(100% - 32px));
      max-height: 80vh;
      overflow: auto;
      border-radius: 24px;
      border: 1px solid var(--line-strong, rgba(255,255,255,0.16));
      background: linear-gradient(180deg, rgba(12, 16, 21, 0.98) 0%, rgba(17, 22, 29, 0.98) 100%);
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      box-shadow:
        0 24px 80px rgba(0, 0, 0, 0.45),
        0 8px 32px rgba(0, 0, 0, 0.25),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
      padding: 24px 28px;
      animation: kb-help-panel-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .kb-help-overlay--out .kb-help-panel {
      animation: kb-help-panel-out 150ms ease both;
    }
    @keyframes kb-help-panel-in {
      from { opacity: 0; transform: scale(0.96) translateY(-8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes kb-help-panel-out {
      from { opacity: 1; transform: scale(1) translateY(0); }
      to   { opacity: 0; transform: scale(0.96) translateY(-8px); }
    }

    @media (prefers-reduced-motion: reduce) {
      .kb-help-overlay,
      .kb-help-overlay--out,
      .kb-help-panel,
      .kb-help-overlay--out .kb-help-panel {
        animation-duration: 0.01ms !important;
      }
    }

    .kb-help-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .kb-help-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--text, #f7f4ee);
    }
    .kb-help-close {
      background: transparent;
      border: 0;
      color: var(--muted, #8f8b82);
      font-size: 1.5rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 8px;
      line-height: 1;
    }
    .kb-help-close:hover {
      color: var(--text, #f7f4ee);
      background: rgba(255, 255, 255, 0.06);
    }
    .kb-help-close:focus-visible {
      outline: 2px solid var(--focus-ring, rgba(62, 180, 165, 0.5));
      outline-offset: 2px;
    }

    .kb-help-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .kb-help-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 12px;
      gap: 16px;
    }
    .kb-help-row:hover {
      background: rgba(255, 255, 255, 0.04);
    }
    .kb-help-keys {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .kb-help-desc {
      color: var(--text-secondary, #d4cfc4);
      font-size: 0.9rem;
      text-align: right;
    }

    kbd {
      display: inline-block;
      padding: 3px 8px;
      font-family: var(--font-mono, "JetBrains Mono", ui-monospace, monospace);
      font-size: 0.8rem;
      line-height: 1.4;
      color: var(--text, #f7f4ee);
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      white-space: nowrap;
    }
  `;
  document.head.appendChild(s);
}
