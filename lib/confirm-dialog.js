/**
 * Reusable custom modal dialog system replacing native confirm/alert/prompt.
 * Injects styles and DOM dynamically (same pattern as lib/toast.js).
 */

// ---------------------------------------------------------------------------
// Style injection
// ---------------------------------------------------------------------------

function ensureDialogStyles() {
  if (document.querySelector("#confirm-dialog-styles")) return;
  const s = document.createElement("style");
  s.id = "confirm-dialog-styles";
  s.textContent = `
    .cd-overlay {
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
    .cd-overlay--out {
      animation: cd-overlay-out 150ms ease forwards;
    }
    .cd-dialog {
      position: relative;
      width: 100%;
      max-width: 440px;
      margin: 16px;
      padding: 28px 28px 24px;
      border-radius: 18px;
      background: rgba(12, 20, 36, 0.95);
      backdrop-filter: blur(16px) saturate(1.4);
      -webkit-backdrop-filter: blur(16px) saturate(1.4);
      border: 1px solid rgba(163, 191, 250, 0.15);
      box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3),
                  inset 0 1px 0 rgba(255,255,255,0.06);
      color: #edf4ff;
      font-family: var(--font-sans, "DM Sans", system-ui, sans-serif);
      animation: cd-dialog-in 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .cd-overlay--out .cd-dialog {
      animation: cd-dialog-out 150ms ease forwards;
    }
    .cd-dialog__title {
      margin: 0 0 8px;
      font-size: 1.1rem;
      font-weight: 600;
      line-height: 1.35;
      color: #edf4ff;
    }
    .cd-dialog__message {
      margin: 0 0 22px;
      font-size: 0.9rem;
      line-height: 1.55;
      color: #8a9bba;
    }
    .cd-dialog__input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin: 0 0 22px;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid rgba(163, 191, 250, 0.18);
      background: rgba(255, 255, 255, 0.05);
      color: #edf4ff;
      font-family: var(--font-sans, "DM Sans", system-ui, sans-serif);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }
    .cd-dialog__input::placeholder {
      color: #5a6e8a;
    }
    .cd-dialog__input:focus {
      border-color: rgba(163, 191, 250, 0.4);
      box-shadow: 0 0 0 3px rgba(163, 191, 250, 0.1);
    }
    .cd-dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .cd-btn {
      border: none;
      cursor: pointer;
      border-radius: 10px;
      font-family: var(--font-sans, "DM Sans", system-ui, sans-serif);
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 160ms ease, color 160ms ease, border-color 160ms ease,
                  box-shadow 200ms ease, transform 180ms ease;
    }
    .cd-btn:active {
      transform: scale(0.97);
    }
    .cd-btn--ghost {
      background: transparent;
      color: #8a9bba;
      border: 1px solid rgba(163, 191, 250, 0.15);
      padding: 10px 18px;
      font-size: 0.8125rem;
      font-weight: 500;
    }
    .cd-btn--ghost:hover {
      color: #edf4ff;
      border-color: rgba(255, 255, 255, 0.18);
      background: rgba(255, 255, 255, 0.04);
    }
    .cd-btn--primary {
      background: linear-gradient(135deg, #3eb4a5 0%, #2a9d8f 50%, #4a8fe7 100%);
      background-size: 200% 200%;
      background-position: 0% 50%;
      color: #fff;
      padding: 10px 22px;
      font-size: 0.875rem;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(62, 180, 165, 0.25),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
    .cd-btn--primary:hover {
      background-position: 100% 50%;
      box-shadow: 0 6px 24px rgba(62, 180, 165, 0.35),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
    .cd-btn--destructive {
      background: var(--crimson, #e85a6b);
      background-size: unset;
      color: #fff;
      padding: 10px 22px;
      font-size: 0.875rem;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(232, 90, 107, 0.3),
                  inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }
    .cd-btn--destructive:hover {
      background: #d44a5b;
      box-shadow: 0 6px 24px rgba(232, 90, 107, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }

    /* Animations */
    @keyframes cd-overlay-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes cd-overlay-out {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    @keyframes cd-dialog-in {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes cd-dialog-out {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
  `;
  document.head.appendChild(s);
}

// ---------------------------------------------------------------------------
// Focus trap helper
// ---------------------------------------------------------------------------

function trapFocus(container) {
  function getFocusable() {
    return Array.from(
      container.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function handleKeydown(e) {
    if (e.key !== "Tab") return;

    const focusable = getFocusable();
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener("keydown", handleKeydown);
  return () => container.removeEventListener("keydown", handleKeydown);
}

// ---------------------------------------------------------------------------
// Core dialog renderer
// ---------------------------------------------------------------------------

/**
 * Internal helper that creates the overlay + dialog DOM, wires up keyboard
 * and backdrop listeners, and returns a Promise resolved when the user acts.
 *
 * @param {Object} opts
 * @param {string}  opts.title
 * @param {string}  [opts.message]
 * @param {Array}   opts.buttons        - Array of { label, className, value }
 * @param {boolean} [opts.hasInput]     - Render a text input
 * @param {string}  [opts.placeholder]
 * @param {string}  [opts.defaultValue]
 * @param {*}       opts.dismissValue   - Value returned on backdrop/Escape dismiss
 * @param {"input"|"confirm"}  [opts.autoFocusTarget]
 * @returns {Promise<*>}
 */
function renderDialog(opts) {
  if (typeof document === "undefined" || !document.body) {
    return Promise.resolve(opts.dismissValue);
  }

  ensureDialogStyles();

  return new Promise((resolve) => {
    let resolved = false;

    // --- Build DOM ---
    const overlay = document.createElement("div");
    overlay.className = "cd-overlay";
    overlay.setAttribute("role", "alertdialog");
    overlay.setAttribute("aria-modal", "true");

    const dialog = document.createElement("div");
    dialog.className = "cd-dialog";

    const titleId = "cd-dialog-title-" + Date.now();
    const messageId = "cd-dialog-message-" + Date.now();

    if (opts.title) {
      overlay.setAttribute("aria-labelledby", titleId);
      const title = document.createElement("h2");
      title.className = "cd-dialog__title";
      title.id = titleId;
      title.textContent = opts.title;
      dialog.appendChild(title);
    } else {
      if (opts.title) overlay.setAttribute("aria-label", opts.title);
    }

    if (opts.message) {
      overlay.setAttribute("aria-describedby", messageId);
      const msg = document.createElement("p");
      msg.className = "cd-dialog__message";
      msg.id = messageId;
      msg.textContent = opts.message;
      dialog.appendChild(msg);
    }

    let input = null;
    if (opts.hasInput) {
      input = document.createElement("input");
      input.className = "cd-dialog__input";
      input.type = "text";
      if (opts.placeholder) input.placeholder = opts.placeholder;
      if (opts.defaultValue != null) input.value = opts.defaultValue;
      dialog.appendChild(input);
    }

    const actions = document.createElement("div");
    actions.className = "cd-dialog__actions";

    let confirmBtn = null;

    opts.buttons.forEach((btnDef) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cd-btn ${btnDef.className}`;
      btn.textContent = btnDef.label;
      btn.addEventListener("click", () => {
        if (btnDef.value === "__input__") {
          dismiss(input ? input.value : "");
        } else {
          dismiss(btnDef.value);
        }
      });
      actions.appendChild(btn);
      if (btnDef.isConfirm) confirmBtn = btn;
    });

    dialog.appendChild(actions);
    overlay.appendChild(dialog);

    // --- Dismiss helper with exit animation ---
    function dismiss(value) {
      if (resolved) return;
      resolved = true;
      overlay.classList.add("cd-overlay--out");
      cleanupTrap();
      setTimeout(() => {
        overlay.remove();
        restoreFocus();
        resolve(value);
      }, 150);
    }

    // --- Backdrop click ---
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) dismiss(opts.dismissValue);
    });

    // --- Escape key ---
    function handleEscape(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismiss(opts.dismissValue);
      }
    }
    overlay.addEventListener("keydown", handleEscape);

    // --- Enter key for prompt input ---
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          dismiss(input.value);
        }
      });
    }

    // --- Save and restore focus ---
    const previouslyFocused = document.activeElement;
    function restoreFocus() {
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    }

    // --- Mount ---
    document.body.appendChild(overlay);

    // --- Focus trap ---
    const cleanupTrap = trapFocus(dialog);

    // --- Auto-focus ---
    if (opts.autoFocusTarget === "input" && input) {
      input.focus();
      if (opts.defaultValue) input.select();
    } else if (confirmBtn) {
      confirmBtn.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Show a confirmation dialog.
 * @param {Object} opts
 * @param {string}  opts.title
 * @param {string}  [opts.message]
 * @param {string}  [opts.confirmLabel="Confirm"]
 * @param {string}  [opts.cancelLabel="Cancel"]
 * @param {boolean} [opts.destructive=false]
 * @returns {Promise<boolean>} true if confirmed, false if cancelled
 */
export function showConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
} = {}) {
  return renderDialog({
    title,
    message,
    dismissValue: false,
    autoFocusTarget: "confirm",
    buttons: [
      { label: cancelLabel, className: "cd-btn--ghost", value: false },
      {
        label: confirmLabel,
        className: destructive ? "cd-btn--destructive" : "cd-btn--primary",
        value: true,
        isConfirm: true,
      },
    ],
  });
}

/**
 * Show an alert dialog (single dismiss button).
 * @param {Object} opts
 * @param {string}  opts.title
 * @param {string}  [opts.message]
 * @param {string}  [opts.buttonLabel="OK"]
 * @returns {Promise<void>} resolves when dismissed
 */
export function showAlertDialog({
  title,
  message,
  buttonLabel = "OK",
} = {}) {
  return renderDialog({
    title,
    message,
    dismissValue: undefined,
    autoFocusTarget: "confirm",
    buttons: [
      {
        label: buttonLabel,
        className: "cd-btn--primary",
        value: undefined,
        isConfirm: true,
      },
    ],
  });
}

/**
 * Show a prompt dialog with a text input.
 * @param {Object} opts
 * @param {string}  opts.title
 * @param {string}  [opts.message]
 * @param {string}  [opts.placeholder]
 * @param {string}  [opts.defaultValue]
 * @param {string}  [opts.confirmLabel="OK"]
 * @returns {Promise<string|null>} the entered value, or null if cancelled
 */
export function showPromptDialog({
  title,
  message,
  placeholder,
  defaultValue,
  confirmLabel = "OK",
} = {}) {
  return renderDialog({
    title,
    message,
    hasInput: true,
    placeholder,
    defaultValue,
    dismissValue: null,
    autoFocusTarget: "input",
    buttons: [
      { label: "Cancel", className: "cd-btn--ghost", value: null },
      {
        label: confirmLabel,
        className: "cd-btn--primary",
        value: "__input__",
        isConfirm: true,
      },
    ],
  });
}
