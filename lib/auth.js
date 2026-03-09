const STORAGE_KEY = "central-command.authorized";
const ALLOWED_EMAILS = ["hondo4185@gmail.com"];

export function isAuthorized() {
  try {
    return ALLOWED_EMAILS.includes(localStorage.getItem(STORAGE_KEY) ?? "");
  } catch {
    return false;
  }
}

export function setAuthorized(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (ALLOWED_EMAILS.includes(normalized)) {
    localStorage.setItem(STORAGE_KEY, normalized);
    return true;
  }
  return false;
}

export function showAuthGate() {
  const existing = document.getElementById("authGate");
  if (existing) return;

  const overlay = document.createElement("div");
  overlay.id = "authGate";
  overlay.className = "auth-gate";
  overlay.innerHTML = `
    <div class="auth-gate__card">
      <h2 class="auth-gate__title">Central Command</h2>
      <p class="auth-gate__text">Enter your email to continue.</p>
      <form id="authGateForm" class="auth-gate__form">
        <input type="email" id="authGateEmail" placeholder="you@example.com" required autocomplete="email" />
        <button type="submit" class="primary-button">Continue</button>
      </form>
      <p id="authGateError" class="auth-gate__error" hidden>Access restricted to authorized users only.</p>
    </div>
  `;

  document.body.prepend(overlay);

  const form = overlay.querySelector("#authGateForm");
  const input = overlay.querySelector("#authGateEmail");
  const error = overlay.querySelector("#authGateError");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    error.hidden = true;

    if (setAuthorized(input.value)) {
      overlay.remove();
      window.dispatchEvent(new CustomEvent("auth:granted"));
    } else {
      error.hidden = false;
    }
  });

  input.focus();
}

export function requireAuth(onGranted) {
  if (isAuthorized()) {
    onGranted?.();
    return;
  }
  showAuthGate();
  window.addEventListener("auth:granted", () => onGranted?.(), { once: true });
}
