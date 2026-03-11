/**
 * Non-blocking toast notifications. Used for storage quota exceeded etc.
 * @param {string} message
 * @param {string} [type] - "error" | "info" | "success"
 */
export function showToast(message, type = "info") {
  if (typeof document === "undefined" || !document.body) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "alert");
  toast.textContent = message;

  const style = document.createElement("style");
  style.textContent = `
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
    }
    .toast--error { border-color: rgba(255, 107, 129, 0.5); }
    .toast--success { border-color: rgba(71, 215, 199, 0.4); }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  if (!document.querySelector("#toast-styles")) {
    const s = document.createElement("style");
    s.id = "toast-styles";
    s.textContent = style.textContent;
    document.head.appendChild(s);
  }

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 180ms";
    setTimeout(() => toast.remove(), 200);
  }, 5000);
}
