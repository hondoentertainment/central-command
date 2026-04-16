/**
 * Small nav-bar indicator that reflects the current sync status. Subscribes to
 * sync-status and updates a compact badge with an optional Retry button on
 * error. Renders nothing when idle and no prior sync has occurred.
 */
import {
  subscribeSyncState,
  attachConnectivityListeners,
  SYNC_STATES,
} from "./sync-status.js";

const LABELS = {
  [SYNC_STATES.idle]: "",
  [SYNC_STATES.syncing]: "Syncing…",
  [SYNC_STATES.synced]: "Synced",
  [SYNC_STATES.offline]: "Offline",
  [SYNC_STATES.error]: "Sync error",
};

const DOT_CLASS = {
  [SYNC_STATES.idle]: "sync-indicator__dot--idle",
  [SYNC_STATES.syncing]: "sync-indicator__dot--syncing",
  [SYNC_STATES.synced]: "sync-indicator__dot--synced",
  [SYNC_STATES.offline]: "sync-indicator__dot--offline",
  [SYNC_STATES.error]: "sync-indicator__dot--error",
};

/**
 * Renders the sync indicator into the given slot. Call once per nav render;
 * subsequent renders replace the content so listeners do not leak.
 * @param {HTMLElement} slot
 * @returns {() => void} unsubscribe
 */
export function renderSyncIndicator(slot) {
  if (!slot) return () => {};
  attachConnectivityListeners();
  slot.innerHTML = "";

  const container = document.createElement("div");
  container.className = "sync-indicator";
  container.setAttribute("aria-live", "polite");
  container.hidden = true;

  const dot = document.createElement("span");
  dot.className = "sync-indicator__dot";
  dot.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "sync-indicator__label";

  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "ghost-button sync-indicator__retry";
  retryBtn.textContent = "Retry";
  retryBtn.hidden = true;

  container.append(dot, label, retryBtn);
  slot.append(container);

  let currentRetry = null;
  retryBtn.addEventListener("click", () => {
    if (typeof currentRetry !== "function") return;
    retryBtn.disabled = true;
    try {
      Promise.resolve(currentRetry()).finally(() => {
        retryBtn.disabled = false;
      });
    } catch {
      retryBtn.disabled = false;
    }
  });

  const unsubscribe = subscribeSyncState((snapshot) => {
    const { status, message, retry } = snapshot;
    if (status === SYNC_STATES.idle) {
      container.hidden = true;
      return;
    }

    container.hidden = false;
    container.dataset.state = status;
    dot.className = `sync-indicator__dot ${DOT_CLASS[status] ?? ""}`;
    label.textContent = message || LABELS[status] || "";
    currentRetry = retry;
    retryBtn.hidden = status !== SYNC_STATES.error || typeof retry !== "function";
  });

  return unsubscribe;
}
