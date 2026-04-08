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
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  toast.setAttribute("aria-atomic", "true");

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
  toast.style.animation = "toast-slide-out 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both";
  toast.addEventListener("animationend", () => toast.remove(), { once: true });
  // Fallback removal in case animationend doesn't fire
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 350);
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
      background: rgba(12, 20, 36, 0.95);
      backdrop-filter: blur(16px) saturate(1.4);
      -webkit-backdrop-filter: blur(16px) saturate(1.4);
      border: 1px solid rgba(163, 191, 250, 0.15);
      color: #edf4ff;
      font-size: 0.9rem;
      box-shadow: 0 16px 48px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06);
      z-index: 10000;
      animation: toast-slide-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 440px;
    }
    .toast--error {
      border-color: rgba(232, 90, 107, 0.4);
      box-shadow: 0 16px 48px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2), 0 0 24px rgba(232, 90, 107, 0.08);
    }
    .toast--success {
      border-color: rgba(62, 180, 165, 0.35);
      box-shadow: 0 16px 48px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2), 0 0 24px rgba(62, 180, 165, 0.08);
    }
    .toast__message { flex: 1; line-height: 1.4; }
    .toast__action {
      background: rgba(163, 191, 250, 0.15);
      border: 1px solid rgba(163, 191, 250, 0.25);
      color: #a3bffa;
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 500;
      white-space: nowrap;
      transition: background 140ms ease;
    }
    .toast__action:hover { background: rgba(163, 191, 250, 0.3); }
    .toast__close {
      background: none;
      border: none;
      color: #667a94;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
      transition: color 140ms ease;
    }
    .toast__close:hover { color: #edf4ff; }
    @keyframes toast-slide-in {
      from { opacity: 0; transform: translateY(24px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes toast-slide-out {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(16px) scale(0.96); }
    }
  `;
  document.head.appendChild(s);
}
