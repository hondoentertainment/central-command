import {
  initFirebase,
  isFirebaseConfigured,
  getAuthInstance,
  firestoreReadTools,
  firestoreReadNotes,
  firestoreReadHistory,
  firestoreWriteTools,
  firestoreWriteNotes,
  firestoreWriteHistory,
  mergeTools,
  mergeNotes,
  mergeHistory,
} from "./firebase.js";
import { showToast } from "./toast.js";

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e?.name === "QuotaExceededError" || e?.code === 22) {
      showToast("Storage full. Export your data and clear some space.", "error");
    }
    return false;
  }
}


export const STORAGE_KEYS = {
  tools: "central-command.tools.v2",
  legacyTools: ["central-command.tools.v1"],
  notes: "central-command.notes.v1",
  notesMeta: "central-command.notes-meta",
  launchHistory: "central-command.launch-history.v1",
  customCategories: "central-command.custom-categories",
  layout: "central-command.layout",
  surfaces: "central-command.surfaces",
  runbookTemplates: "central-command.runbook-templates",
  integrations: "central-command.integrations",
};

function loadJson(key) {
  try {
    const raw = safeGetItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadStoredToolPayload() {
  const current = loadJson(STORAGE_KEYS.tools);
  if (current) return current;

  for (const legacyKey of STORAGE_KEYS.legacyTools) {
    const legacy = loadJson(legacyKey);
    if (legacy) return legacy;
  }

  return null;
}

export function hasSavedTools() {
  try {
    if (safeGetItem(STORAGE_KEYS.tools) !== null) return true;
    return STORAGE_KEYS.legacyTools.some((legacyKey) => safeGetItem(legacyKey) !== null);
  } catch {
    return false;
  }
}

export function loadStoredTools(hydrateTools, fallbackTools) {
  const stored = loadStoredToolPayload();
  if (!stored) return structuredClone(fallbackTools);

  const hydrated = hydrateTools(stored);
  return hydrated.length > 0 ? hydrated : structuredClone(fallbackTools);
}

export function saveStoredTools(tools) {
  safeSetItem(STORAGE_KEYS.tools, JSON.stringify(tools));
}

export function loadNotes() {
  try {
    return safeGetItem(STORAGE_KEYS.notes) ?? "";
  } catch {
    return "";
  }
}

export function saveNotes(notes) {
  safeSetItem(STORAGE_KEYS.notes, notes);
  const meta = { lastEdited: new Date().toISOString() };
  safeSetItem(STORAGE_KEYS.notesMeta, JSON.stringify(meta));
}

export function loadNotesMeta() {
  const raw = safeGetItem(STORAGE_KEYS.notesMeta);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadRunbookTemplates() {
  const raw = loadJson(STORAGE_KEYS.runbookTemplates);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t) => t && typeof t === "object" && typeof t.id === "string" && typeof t.name === "string" && typeof t.content === "string"
  );
}

export function saveRunbookTemplates(templates) {
  safeSetItem(STORAGE_KEYS.runbookTemplates, JSON.stringify(templates));
}

export function loadLaunchHistory(sanitizeLaunchHistory) {
  return sanitizeLaunchHistory(loadJson(STORAGE_KEYS.launchHistory));
}

export function saveLaunchHistory(history) {
  safeSetItem(STORAGE_KEYS.launchHistory, JSON.stringify(history));
}

// --- Sync layer (Firebase) ---

/**
 * Get current user uid if signed in. Requires Firebase initialized.
 */
function getCurrentUid() {
  const auth = getAuthInstance();
  return auth?.currentUser?.uid ?? null;
}

function addUpdatedAtToTools(tools) {
  const now = new Date().toISOString();
  return (tools || []).map((t) => ({ ...t, updatedAt: t?.updatedAt ?? now }));
}

/**
 * Load tools with optional Firestore sync. When signed in: fetches from cloud, merges (last-write-wins),
 * uploads local if cloud empty. Otherwise uses localStorage.
 * @returns {Promise<Array>}
 */
export async function loadStoredToolsSynced(hydrateTools, fallbackTools) {
  const localTools = loadStoredTools(hydrateTools, fallbackTools);
  const localPayload = loadStoredToolPayload();

  await initFirebase();
  const uid = getCurrentUid();
  if (!uid || !isFirebaseConfigured()) {
    if (!localPayload?.length && localTools?.length) {
      saveStoredTools(structuredClone(localTools));
    }
    return structuredClone(localTools);
  }

  try {
    const cloudData = await firestoreReadTools(uid);
    if (cloudData?.tools?.length) {
      const merged = mergeTools(localPayload ?? [], cloudData);
      const hydrated = hydrateTools(merged);
      const result = hydrated.length > 0 ? hydrated : structuredClone(localTools);
      if (!localPayload?.length && result?.length) {
        saveStoredTools(structuredClone(result));
      }
      return result;
    }
    if (localPayload?.length) {
      const withUpdatedAt = addUpdatedAtToTools(localPayload);
      await firestoreWriteTools(uid, withUpdatedAt);
    } else if (localTools?.length) {
      saveStoredTools(structuredClone(localTools));
    }
  } catch (err) {
    console.warn("Sync load tools failed, using local:", err?.message);
    if (!localPayload?.length && localTools?.length) {
      saveStoredTools(structuredClone(localTools));
    }
  }
  return structuredClone(localTools);
}

/**
 * Save tools to localStorage and Firestore (when signed in). Adds updatedAt to each tool.
 * @param {Array} tools
 */
export async function saveStoredToolsSynced(tools) {
  const withUpdatedAt = addUpdatedAtToTools(tools);
  saveStoredTools(withUpdatedAt);

  const uid = getCurrentUid();
  if (uid && isFirebaseConfigured()) {
    try {
      await firestoreWriteTools(uid, withUpdatedAt);
    } catch (err) {
      console.warn("Sync save tools failed (offline writes cached by Firestore):", err?.message);
    }
  }
}

/**
 * Load notes with optional Firestore sync.
 * @returns {Promise<string>}
 */
export async function loadNotesSynced() {
  const localNotes = loadNotes();
  await initFirebase();
  const uid = getCurrentUid();
  if (!uid || !isFirebaseConfigured()) return localNotes;

  try {
    const cloudData = await firestoreReadNotes(uid);
    return mergeNotes(localNotes, cloudData);
  } catch (err) {
    console.warn("Sync load notes failed, using local:", err?.message);
  }
  return localNotes;
}

/**
 * Save notes to localStorage and Firestore (when signed in).
 * @param {string} notes
 */
export async function saveNotesSynced(notes) {
  saveNotes(notes);
  const uid = getCurrentUid();
  if (uid && isFirebaseConfigured()) {
    try {
      await firestoreWriteNotes(uid, notes);
    } catch (err) {
      console.warn("Sync save notes failed:", err?.message);
    }
  }
}

/**
 * Load launch history with optional Firestore sync.
 * @param {Function} sanitizeLaunchHistory
 * @returns {Promise<Array>}
 */
export async function loadLaunchHistorySynced(sanitizeLaunchHistory) {
  const local = loadLaunchHistory(sanitizeLaunchHistory);
  await initFirebase();
  const uid = getCurrentUid();
  if (!uid || !isFirebaseConfigured()) return local;

  try {
    const cloudData = await firestoreReadHistory(uid);
    const merged = mergeHistory(local, cloudData);
    return sanitizeLaunchHistory(merged);
  } catch (err) {
    console.warn("Sync load history failed, using local:", err?.message);
  }
  return local;
}

/**
 * Save launch history to localStorage and Firestore (when signed in).
 * @param {Array} history
 */
export async function saveLaunchHistorySynced(history) {
  saveLaunchHistory(history);
  const uid = getCurrentUid();
  if (uid && isFirebaseConfigured()) {
    try {
      await firestoreWriteHistory(uid, history);
    } catch (err) {
      console.warn("Sync save history failed:", err?.message);
    }
  }
}

/**
 * Perform initial sync when user signs in: upload local to cloud if cloud empty,
 * or download and merge if cloud has data. Call after auth state changes to signed in.
 * @param {Object} opts
 * @param {Function} opts.hydrateTools
 * @param {Array} opts.fallbackTools
 * @param {Function} opts.sanitizeLaunchHistory
 * @param {(data: {tools, notes, history}) => void} opts.onSynced - Called with merged data
 */
export async function performInitialSync(opts) {
  await initFirebase();
  const uid = getCurrentUid();
  if (!uid || !isFirebaseConfigured()) return;

  const { hydrateTools, fallbackTools, sanitizeLaunchHistory, onSynced } = opts;

  try {
    const [cloudTools, cloudNotes, cloudHistory] = await Promise.all([
      firestoreReadTools(uid),
      firestoreReadNotes(uid),
      firestoreReadHistory(uid),
    ]);

    const localPayload = loadStoredToolPayload();
    const localNotes = loadNotes();
    const localHistory = sanitizeLaunchHistory(loadJson(STORAGE_KEYS.launchHistory));

    let tools = localPayload ?? [];
    let notes = localNotes;
    let history = localHistory;

    if (cloudTools?.tools?.length) {
      tools = mergeTools(tools, cloudTools);
    } else if (tools?.length) {
      tools = addUpdatedAtToTools(tools);
      await firestoreWriteTools(uid, tools);
    }

    if (cloudNotes && typeof cloudNotes.notes === "string") {
      notes = mergeNotes(notes, cloudNotes);
    } else if (notes) {
      await firestoreWriteNotes(uid, notes);
    }

    if (cloudHistory?.history?.length) {
      history = mergeHistory(history, cloudHistory);
    } else if (history?.length) {
      await firestoreWriteHistory(uid, history);
    }

    saveStoredTools(tools);
    saveNotes(notes);
    saveLaunchHistory(history);

    const hydratedTools = hydrateTools(tools);
    onSynced?.({
      tools: hydratedTools.length > 0 ? hydratedTools : fallbackTools ? structuredClone(fallbackTools) : [],
      notes,
      history,
    });
  } catch (err) {
    console.warn("Initial sync failed:", err?.message);
  }
}

export function loadCustomCategories() {
  try {
    const raw = safeGetItem(STORAGE_KEYS.customCategories);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string" && c.trim()) : [];
  } catch {
    return [];
  }
}

export function saveCustomCategories(categories) {
  try {
    const list = Array.isArray(categories)
      ? categories.filter((c) => typeof c === "string" && c.trim())
      : [];
    safeSetItem(STORAGE_KEYS.customCategories, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

export function loadLayoutPreference() {
  try {
    const v = safeGetItem(STORAGE_KEYS.layout);
    return v === "list" || v === "compact" ? v : "grid";
  } catch {
    return "grid";
  }
}

export function saveLayoutPreference(layout) {
  try {
    if (layout === "list" || layout === "compact") {
      safeSetItem(STORAGE_KEYS.layout, layout);
    } else {
      safeSetItem(STORAGE_KEYS.layout, "grid");
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadSurfacesPreferences() {
  try {
    const raw = safeGetItem(STORAGE_KEYS.surfaces);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSurfacesPreferences(prefs) {
  try {
    if (prefs && typeof prefs === "object") {
      safeSetItem(STORAGE_KEYS.surfaces, JSON.stringify(prefs));
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadIntegrationsPreferences() {
  try {
    const raw = safeGetItem(STORAGE_KEYS.integrations);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveIntegrationsPreferences(prefs) {
  try {
    if (prefs && typeof prefs === "object") {
      safeSetItem(STORAGE_KEYS.integrations, JSON.stringify(prefs));
    }
  } catch {
    // Ignore storage errors
  }
}
