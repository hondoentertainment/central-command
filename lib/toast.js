/**
 * Non-blocking toast notifications with optional action buttons.
 * @param {string} message
 * @param {string} [type] - "error" | "info" | "success"
 * @param {Object} [options]
 * @param {string} [options.actionLabel] - Text for action button
 * @param {() => void} [options.onAction] - Callback when action button clicked
 * @param {number} [options.duration] - Auto-dismiss duration in ms (default 5000, 0 for manual)
 */
export function showToast(message, type = "info", options = {}) {
  if (typeof document === "undefined" || !document.body) return;

  ensureToastStyles();

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "alert");

  const msg = document.createElement("span");
  msg.className = "toast__message";
  msg.textContent = message;
  toast.appendChild(msg);

  if (options.actionLabel && options.onAction) {
    const btn = document.createElement("button");
    btn.className = "toast__action";
    btn.type = "button";
    btn.textContent = options.actionLabel;
    btn.addEventListener("click", () => {
      options.onAction();
      dismissToast(toast);
    });
    toast.appendChild(btn);
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "toast__close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.textContent = "\u00d7";
  closeBtn.addEventListener("click", () => dismissToast(toast));
  toast.appendChild(closeBtn);

  document.body.appendChild(toast);

  const duration = options.duration ?? 5000;
  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
}

function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.style.opacity = "0";
  toast.style.transition = "opacity 180ms";
  setTimeout(() => toast.remove(), 200);
}

function ensureToastStyles() {
  if (document.querySelector("#toast-styles")) return;
  const s = document.createElement("style");
  s.id = "toast-styles";
  s.textContent = `
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 14px 20px;
      border-radius: 14px;
      background: rgba(15, 28, 49, 0.96);
      border: 1px solid rgba(163, 191, 250, 0.2);
      color: #edf4ff;
      font-size: 0.94rem;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4);
      z-index: 10000;
      animation: toast-in 200ms ease;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 420px;
    }
    .toast--error { border-color: rgba(255, 107, 129, 0.5); }
    .toast--success { border-color: rgba(71, 215, 199, 0.4); }
    .toast__message { flex: 1; }
    .toast__action {
      background: rgba(163, 191, 250, 0.2);
      border: 1px solid rgba(163, 191, 250, 0.3);
      color: #a3bffa;
      padding: 4px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      white-space: nowrap;
    }
    .toast__action:hover { background: rgba(163, 191, 250, 0.35); }
    .toast__close {
      background: none;
      border: none;
      color: #8899b3;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .toast__close:hover { color: #edf4ff; }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(s);
}
