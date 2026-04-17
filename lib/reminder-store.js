/**
 * Minimal IndexedDB wrapper that stores a single snapshot record accessible to
 * both the page and the service worker. Used for task-reminder periodic sync:
 * the page writes the snapshot, the SW reads it when a periodicsync fires.
 *
 * Layout: one database `central-command.reminders`, one store `snapshots`,
 * one row with key `due-today`. Writes replace the row completely.
 */

const DB_NAME = "central-command.reminders";
const DB_VERSION = 1;
const STORE = "snapshots";
const DUE_TODAY_KEY = "due-today";

function idb() {
  if (typeof indexedDB === "undefined") return null;
  return indexedDB;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const factory = idb();
    if (!factory) {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(result instanceof IDBRequest ? result.result : result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Saves a snapshot of tasks due today. `tasks` is sliced to essentials so the
 * row stays small; `remindedIds` carries forward which tasks were already
 * announced to avoid duplicate notifications.
 * @param {{tasks: Array, remindedIds: string[], savedAt: string, date: string}} snapshot
 */
export async function saveDueTodaySnapshot(snapshot) {
  try {
    await withStore("readwrite", (store) => store.put(snapshot, DUE_TODAY_KEY));
  } catch {
    // IndexedDB unavailable (private mode, Safari quirks) — reminders fall
    // back to in-page notifications only.
  }
}

export async function loadDueTodaySnapshot() {
  try {
    return await withStore("readonly", (store) => store.get(DUE_TODAY_KEY));
  } catch {
    return null;
  }
}

export async function clearDueTodaySnapshot() {
  try {
    await withStore("readwrite", (store) => store.delete(DUE_TODAY_KEY));
  } catch {
    // ignore
  }
}

export const REMINDER_DB = {
  name: DB_NAME,
  version: DB_VERSION,
  store: STORE,
  key: DUE_TODAY_KEY,
};
