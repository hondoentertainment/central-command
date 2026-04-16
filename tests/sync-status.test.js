import assert from "node:assert";

// Node 20+ has a read-only navigator getter. We don't redefine it; instead we
// rely on its default navigator.onLine === true and swap it per-test via
// Object.defineProperty when we need to simulate offline.
const originalNavigator = global.navigator;
function setNavigatorOnLine(value) {
  Object.defineProperty(global, "navigator", {
    configurable: true,
    get: () => ({ onLine: value }),
  });
}
function restoreNavigator() {
  if (originalNavigator) {
    Object.defineProperty(global, "navigator", {
      configurable: true,
      get: () => originalNavigator,
    });
  }
}

const {
  SYNC_STATES,
  getSyncState,
  subscribeSyncState,
  markSyncStart,
  markSyncSuccess,
  markSyncError,
  markSyncOffline,
  resetSyncState,
} = await import("../lib/sync-status.js");

// Initial state is idle.
resetSyncState();
assert.strictEqual(getSyncState().status, SYNC_STATES.idle);

// Subscriber receives a replay immediately.
let received = null;
const unsubscribe = subscribeSyncState((snap) => {
  received = snap;
});
assert.ok(received, "subscriber should receive initial snapshot");
assert.strictEqual(received.status, SYNC_STATES.idle);

// Start -> syncing.
markSyncStart("Syncing tools…");
assert.strictEqual(getSyncState().status, SYNC_STATES.syncing);
assert.strictEqual(getSyncState().message, "Syncing tools…");
assert.strictEqual(received.status, SYNC_STATES.syncing);

// Success -> synced, lastSyncedAt is set.
markSyncSuccess();
assert.strictEqual(getSyncState().status, SYNC_STATES.synced);
assert.ok(getSyncState().lastSyncedAt, "lastSyncedAt should be set after success");

// Concurrent starts coalesce: two starts, one success keeps us in syncing.
resetSyncState();
markSyncStart();
markSyncStart();
markSyncSuccess();
assert.strictEqual(getSyncState().status, SYNC_STATES.syncing, "should remain syncing until last op finishes");
markSyncSuccess();
assert.strictEqual(getSyncState().status, SYNC_STATES.synced);

// Error carries message and retry.
resetSyncState();
markSyncStart();
let retried = 0;
markSyncError("boom", () => { retried++; });
const errState = getSyncState();
assert.strictEqual(errState.status, SYNC_STATES.error);
assert.strictEqual(errState.message, "boom");
assert.strictEqual(typeof errState.retry, "function");
errState.retry();
assert.strictEqual(retried, 1);

// Offline state.
resetSyncState();
markSyncOffline("No network");
assert.strictEqual(getSyncState().status, SYNC_STATES.offline);
assert.ok(getSyncState().message.includes("No network"));

// Start while offline reports offline rather than syncing.
resetSyncState();
setNavigatorOnLine(false);
markSyncStart();
assert.strictEqual(getSyncState().status, SYNC_STATES.offline);
restoreNavigator();

unsubscribe();
resetSyncState();

console.log("sync-status.test.js: all assertions passed");
export default { ok: true };
