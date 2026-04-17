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
import { canUserWriteCloudSync, getAccountTier } from "./auth-policy.js";
import { showToast } from "./toast.js";
import {
  markSyncStart,
  markSyncSuccess,
  markSyncError,
} from "./sync-status.js";

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


/**
 * localStorage key names and legacy keys used for migration.
 * @type {{ tools: string, legacyTools: string[], notes: string, notesMeta: string, launchHistory: string, customCategories: string, layout: string, surfaces: string, runbookTemplates: string, integrations: string, securityEvents: string }}
 */
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
  securityEvents: "central-command.security-events.v1",
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

const MAX_SECURITY_EVENTS = 100;

/**
 * Returns whether any tools are stored in localStorage (current or legacy keys).
 * @returns {boolean}
 */
export function hasSavedTools() {
  try {
    if (safeGetItem(STORAGE_KEYS.tools) !== null) return true;
    return STORAGE_KEYS.legacyTools.some((legacyKey) => safeGetItem(legacyKey) !== null);
  } catch {
    return false;
  }
}

/**
 * Loads tools from localStorage, hydrates with metadata, or returns a clone of fallback.
 * @param {Function} hydrateTools - Function(stored) => hydrated tool array
 * @param {Array} fallbackTools - Used when no stored data or hydration yields empty
 * @returns {Array} Hydrated tools or cloned fallback
 */
export function loadStoredTools(hydrateTools, fallbackTools) {
  const stored = loadStoredToolPayload();
  if (!stored) return structuredClone(fallbackTools);

  const hydrated = hydrateTools(stored);
  return hydrated.length > 0 ? hydrated : structuredClone(fallbackTools);
}

/**
 * Persists tools to localStorage under the current tools key.
 * @param {Array} tools - Tool array to save
 * @returns {void}
 */
export function saveStoredTools(tools) {
  safeSetItem(STORAGE_KEYS.tools, JSON.stringify(tools));
}

/**
 * Loads runbook/daily notes from localStorage.
 * @returns {string} Notes text or empty string
 */
export function loadNotes() {
  try {
    return safeGetItem(STORAGE_KEYS.notes) ?? "";
  } catch {
    return "";
  }
}

/**
 * Saves runbook/daily notes and updates notes metadata (e.g. lastEdited).
 * @param {string} notes - Notes text to save
 * @returns {void}
 */
export function saveNotes(notes) {
  safeSetItem(STORAGE_KEYS.notes, notes);
  const meta = { lastEdited: new Date().toISOString() };
  safeSetItem(STORAGE_KEYS.notesMeta, JSON.stringify(meta));
}

/**
 * Loads notes metadata (e.g. lastEdited) from localStorage.
 * @returns {Object|null} Parsed meta object or null
 */
export function loadNotesMeta() {
  const raw = safeGetItem(STORAGE_KEYS.notesMeta);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Loads runbook templates from localStorage; returns only valid entries (id, name, content strings).
 * @returns {Array<{id: string, name: string, content: string}>}
 */
export function loadRunbookTemplates() {
  const raw = loadJson(STORAGE_KEYS.runbookTemplates);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t) => t && typeof t === "object" && typeof t.id === "string" && typeof t.name === "string" && typeof t.content === "string"
  );
}

/**
 * Persists runbook templates to localStorage.
 * @param {Array} templates - Array of template objects
 * @returns {void}
 */
export function saveRunbookTemplates(templates) {
  safeSetItem(STORAGE_KEYS.runbookTemplates, JSON.stringify(templates));
}

/**
 * Loads launch history from localStorage and sanitizes it.
 * @param {Function} sanitizeLaunchHistory - Function(raw) => sanitized history array
 * @returns {Array} Sanitized launch history
 */
export function loadLaunchHistory(sanitizeLaunchHistory) {
  return sanitizeLaunchHistory(loadJson(STORAGE_KEYS.launchHistory));
}

/**
 * Persists launch history to localStorage.
 * @param {Array} history - Launch history array
 * @returns {void}
 */
export function saveLaunchHistory(history) {
  safeSetItem(STORAGE_KEYS.launchHistory, JSON.stringify(history));
}

/**
 * Loads security events from localStorage, filtered to valid entries and capped by limit.
 * @param {number} [limit=30] - Max number of events to return
 * @returns {Array<{type: string, at: string, [details]: Object}>}
 */
export function loadSecurityEvents(limit = 30) {
  const raw = loadJson(STORAGE_KEYS.securityEvents);
  if (!Array.isArray(raw)) return [];
  const normalized = raw.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      typeof entry.type === "string" &&
      typeof entry.at === "string"
  );
  return normalized.slice(0, Math.max(0, limit));
}

/**
 * Appends a security event (type, timestamp, account tier, details) and trims to max size.
 * @param {string} type - Event type identifier
 * @param {Object} [details={}] - Optional details object
 * @returns {void}
 */
export function recordSecurityEvent(type, details = {}) {
  if (!type || typeof type !== "string") return;
  const current = loadSecurityEvents(MAX_SECURITY_EVENTS);
  const auth = getAuthInstance();
  const user = auth?.currentUser ?? null;
  const nextEvent = {
    id:
      typeof crypto !== "undefined" && crypto?.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    at: new Date().toISOString(),
    accountTier: getAccountTier(
      user
        ? {
            isAnonymous: !!user.isAnonymous,
            emailVerified: !!user.emailVerified,
          }
        : null
    ),
    details: details && typeof details === "object" ? details : {},
  };
  const next = [nextEvent, ...current].slice(0, MAX_SECURITY_EVENTS);
  safeSetItem(STORAGE_KEYS.securityEvents, JSON.stringify(next));
}

// --- Sync layer (Firebase) ---

/**
 * Get current user uid if signed in. Requires Firebase initialized.
 */
function getCurrentUid() {
  const auth = getAuthInstance();
  return auth?.currentUser?.uid ?? null;
}

function getCurrentUserSnapshot() {
  const auth = getAuthInstance();
  const user = auth?.currentUser;
  if (!user) return null;
  return {
    uid: user.uid,
    isAnonymous: !!user.isAnonymous,
    emailVerified: !!user.emailVerified,
  };
}

function addUpdatedAtToTools(tools) {
  const now = new Date().toISOString();
  return (tools || []).map((t) => ({ ...t, updatedAt: t?.updatedAt ?? now }));
}

/**
 * Load tools with optional Firestore sync. When signed in: fetches from cloud, merges (last-write-wins),
 * uploads local if cloud empty. Otherwise uses localStorage.
 * @param {Function} hydrateTools - Function(stored) => hydrated tool array
 * @param {Array} fallbackTools - Fallback when no data or hydration yields empty
 * @returns {Promise<Array>}
 */
export async function loadStoredToolsSynced(hydrateTools, fallbackTools) {
  const localTools = loadStoredTools(hydrateTools, fallbackTools);
  const localPayload = loadStoredToolPayload();

  await initFirebase();
  const user = getCurrentUserSnapshot();
  const uid = user?.uid ?? null;
  if (!uid || !isFirebaseConfigured()) {
    if (!localPayload?.length && localTools?.length) {
      saveStoredTools(structuredClone(localTools));
    }
    return structuredClone(localTools);
  }

  markSyncStart("Loading tools…");
  try {
    const cloudData = await firestoreReadTools(uid);
    if (cloudData?.tools?.length) {
      const merged = mergeTools(localPayload ?? [], cloudData);
      const hydrated = hydrateTools(merged);
      const result = hydrated.length > 0 ? hydrated : structuredClone(localTools);
      if (!localPayload?.length && result?.length) {
        saveStoredTools(structuredClone(result));
      }
      markSyncSuccess();
      return result;
    }
    if (localPayload?.length && canUserWriteCloudSync(user)) {
      const withUpdatedAt = addUpdatedAtToTools(localPayload);
      await firestoreWriteTools(uid, withUpdatedAt);
    } else if (localTools?.length) {
      saveStoredTools(structuredClone(localTools));
    }
    markSyncSuccess();
  } catch (err) {
    console.warn("Sync load tools failed, using local:", err?.message);
    markSyncError("Could not load tools from cloud.", () =>
      loadStoredToolsSynced(hydrateTools, fallbackTools)
    );
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

  const user = getCurrentUserSnapshot();
  const uid = user?.uid ?? null;
  if (uid && isFirebaseConfigured() && canUserWriteCloudSync(user)) {
    markSyncStart("Saving tools…");
    try {
      await firestoreWriteTools(uid, withUpdatedAt);
      markSyncSuccess();
    } catch (err) {
      console.warn("Sync save tools failed (offline writes cached by Firestore):", err?.message);
      markSyncError("Tools saved locally but cloud sync failed.", () => saveStoredToolsSynced(tools));
      showToast("Tools saved locally but cloud sync failed.", "error", {
        actionLabel: "Retry",
        onAction: () => saveStoredToolsSynced(tools),
      });
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

  markSyncStart("Loading notes…");
  try {
    const cloudData = await firestoreReadNotes(uid);
    markSyncSuccess();
    return mergeNotes(localNotes, cloudData);
  } catch (err) {
    console.warn("Sync load notes failed, using local:", err?.message);
    markSyncError("Could not load notes from cloud.", loadNotesSynced);
  }
  return localNotes;
}

/**
 * Save notes to localStorage and Firestore (when signed in).
 * @param {string} notes
 */
export async function saveNotesSynced(notes) {
  saveNotes(notes);
  const user = getCurrentUserSnapshot();
  const uid = user?.uid ?? null;
  if (uid && isFirebaseConfigured() && canUserWriteCloudSync(user)) {
    markSyncStart("Saving notes…");
    try {
      await firestoreWriteNotes(uid, notes);
      markSyncSuccess();
    } catch (err) {
      console.warn("Sync save notes failed:", err?.message);
      markSyncError("Notes saved locally but cloud sync failed.", () => saveNotesSynced(notes));
      showToast("Notes saved locally but cloud sync failed.", "error", {
        actionLabel: "Retry",
        onAction: () => saveNotesSynced(notes),
      });
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

  markSyncStart("Loading history…");
  try {
    const cloudData = await firestoreReadHistory(uid);
    const merged = mergeHistory(local, cloudData);
    markSyncSuccess();
    return sanitizeLaunchHistory(merged);
  } catch (err) {
    console.warn("Sync load history failed, using local:", err?.message);
    markSyncError("Could not load history from cloud.", () => loadLaunchHistorySynced(sanitizeLaunchHistory));
  }
  return local;
}

/**
 * Save launch history to localStorage and Firestore (when signed in).
 * @param {Array} history
 */
export async function saveLaunchHistorySynced(history) {
  saveLaunchHistory(history);
  const user = getCurrentUserSnapshot();
  const uid = user?.uid ?? null;
  if (uid && isFirebaseConfigured() && canUserWriteCloudSync(user)) {
    markSyncStart("Saving history…");
    try {
      await firestoreWriteHistory(uid, history);
      markSyncSuccess();
    } catch (err) {
      console.warn("Sync save history failed:", err?.message);
      markSyncError("History saved locally but cloud sync failed.", () => saveLaunchHistorySynced(history));
      showToast("History saved locally but cloud sync failed.", "error");
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
  const user = getCurrentUserSnapshot();
  const uid = user?.uid ?? null;
  if (!uid || !isFirebaseConfigured()) return;

  const { hydrateTools, fallbackTools, sanitizeLaunchHistory, onSynced } = opts;

  markSyncStart("Syncing with cloud…");
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

    const canWriteCloud = canUserWriteCloudSync(user);

    if (cloudTools?.tools?.length) {
      tools = mergeTools(tools, cloudTools);
    } else if (canWriteCloud && tools?.length) {
      tools = addUpdatedAtToTools(tools);
      await firestoreWriteTools(uid, tools);
    }

    if (cloudNotes && typeof cloudNotes.notes === "string") {
      notes = mergeNotes(notes, cloudNotes);
    } else if (canWriteCloud && notes) {
      await firestoreWriteNotes(uid, notes);
    }

    if (cloudHistory?.history?.length) {
      history = mergeHistory(history, cloudHistory);
    } else if (canWriteCloud && history?.length) {
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
    markSyncSuccess("Initial sync complete.");
  } catch (err) {
    console.warn("Initial sync failed:", err?.message);
    markSyncError("Cloud sync failed. Your local data is safe.", () => performInitialSync(opts));
    showToast("Cloud sync failed. Your local data is safe.", "error", {
      actionLabel: "Retry",
      onAction: () => performInitialSync(opts),
    });
  }
}

/**
 * Loads custom category names from localStorage (non-empty strings only).
 * @returns {string[]}
 */
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

/**
 * Saves custom category list to localStorage (non-empty strings only).
 * @param {string[]} categories - Category names
 * @returns {void}
 */
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

/**
 * Loads layout preference from localStorage (grid, list, or compact).
 * @returns {"grid"|"list"|"compact"}
 */
export function loadLayoutPreference() {
  try {
    const v = safeGetItem(STORAGE_KEYS.layout);
    return v === "list" || v === "compact" ? v : "grid";
  } catch {
    return "grid";
  }
}

/**
 * Saves layout preference; invalid values are stored as "grid".
 * @param {string} layout - "grid" | "list" | "compact"
 * @returns {void}
 */
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

/**
 * Loads surfaces preferences object from localStorage.
 * @returns {Object|null} Parsed preferences or null
 */
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

/**
 * Saves surfaces preferences to localStorage (only if prefs is a non-null object).
 * @param {Object} prefs - Preferences object
 * @returns {void}
 */
export function saveSurfacesPreferences(prefs) {
  try {
    if (prefs && typeof prefs === "object") {
      safeSetItem(STORAGE_KEYS.surfaces, JSON.stringify(prefs));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Loads integrations preferences object from localStorage.
 * @returns {Object|null} Parsed preferences or null
 */
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

/**
 * Saves integrations preferences to localStorage (only if prefs is a non-null object).
 * @param {Object} prefs - Preferences object
 * @returns {void}
 */
export function saveIntegrationsPreferences(prefs) {
  try {
    if (prefs && typeof prefs === "object") {
      safeSetItem(STORAGE_KEYS.integrations, JSON.stringify(prefs));
    }
  } catch {
    // Ignore storage errors
  }
}
