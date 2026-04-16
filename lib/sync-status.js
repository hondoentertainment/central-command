/**
 * Sync status pub/sub. Tracks the live state of cloud sync operations so the
 * UI can reflect syncing / synced / offline / error without polling.
 *
 * States:
 *   - "idle"    : no sync has run (default, pre-sign-in)
 *   - "syncing" : a read/write is in flight
 *   - "synced"  : the last operation completed successfully
 *   - "offline" : navigator reports offline
 *   - "error"   : the last operation failed; a retry handler may be attached
 */

export const SYNC_STATES = Object.freeze({
  idle: "idle",
  syncing: "syncing",
  synced: "synced",
  offline: "offline",
  error: "error",
});

const state = {
  status: SYNC_STATES.idle,
  message: "",
  lastSyncedAt: null,
  retry: null,
  inFlight: 0,
};

const listeners = new Set();

function emit() {
  const snapshot = getSyncState();
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // ignore listener errors
    }
  }
}

export function getSyncState() {
  return {
    status: state.status,
    message: state.message,
    lastSyncedAt: state.lastSyncedAt,
    retry: state.retry,
    inFlight: state.inFlight,
  };
}

export function subscribeSyncState(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  listener(getSyncState());
  return () => listeners.delete(listener);
}

function setStatus(status, { message = "", retry = null, lastSyncedAt } = {}) {
  state.status = status;
  state.message = message;
  state.retry = typeof retry === "function" ? retry : null;
  if (lastSyncedAt !== undefined) state.lastSyncedAt = lastSyncedAt;
  emit();
}

/**
 * Marks the start of a sync operation. Multiple concurrent operations are
 * coalesced: only the last finish or fail flips the status back.
 * @param {string} [label]
 */
export function markSyncStart(label = "") {
  state.inFlight += 1;
  if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) {
    setStatus(SYNC_STATES.offline, { message: "Offline — changes saved locally." });
    return;
  }
  setStatus(SYNC_STATES.syncing, { message: label || "Syncing…" });
}

export function markSyncSuccess(label = "") {
  state.inFlight = Math.max(0, state.inFlight - 1);
  const now = new Date().toISOString();
  if (state.inFlight === 0) {
    setStatus(SYNC_STATES.synced, {
      message: label || "All changes synced.",
      lastSyncedAt: now,
    });
  } else {
    state.lastSyncedAt = now;
    emit();
  }
}

export function markSyncError(message = "Sync failed.", retry = null) {
  state.inFlight = Math.max(0, state.inFlight - 1);
  setStatus(SYNC_STATES.error, { message, retry });
}

export function markSyncOffline(message = "Offline — changes saved locally.") {
  setStatus(SYNC_STATES.offline, { message });
}

export function resetSyncState() {
  state.inFlight = 0;
  setStatus(SYNC_STATES.idle, { message: "", retry: null, lastSyncedAt: null });
}

let onlineListenerAttached = false;

/**
 * Attaches online/offline listeners once. Call during app bootstrap; subsequent
 * calls are no-ops. Uses the provided window handle (or global window) so it
 * can be exercised from Node tests.
 * @param {Window} [win]
 */
export function attachConnectivityListeners(win) {
  if (onlineListenerAttached) return;
  const target = win ?? (typeof window !== "undefined" ? window : null);
  if (!target || typeof target.addEventListener !== "function") return;
  onlineListenerAttached = true;

  target.addEventListener("online", () => {
    if (state.status === SYNC_STATES.offline) {
      setStatus(SYNC_STATES.idle, { message: "Back online." });
    }
  });
  target.addEventListener("offline", () => {
    markSyncOffline();
  });

  if (target.navigator && target.navigator.onLine === false) {
    markSyncOffline();
  }
}
