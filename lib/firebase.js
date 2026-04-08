/**
 * Firebase initialization and sync utilities.
 * Uses Firebase Web SDK v10 modular imports from CDN.
 * Requires firebase.config.local.js (copy from config/firebase.config.example.js).
 */

const FIREBASE_SDK_VERSION = "10.14.0";
const CDN_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let initPromise = null;
let configValid = false;

/**
 * Load Firebase config. Tries generated (from env), then local, then example.
 * @returns {Promise<Object|null>}
 */
async function loadFirebaseConfig() {
  for (const p of [
    "../config/firebase.config.generated.js",
    "../firebase.config.local.js",
    "../config/firebase.config.local.js",
  ]) {
    try {
      const cfg = await import(p).then((m) => m.default);
      if (cfg) return cfg;
    } catch {
      // May not exist
    }
  }
  try {
    const example = await import("../config/firebase.config.example.js").then((m) => m.default);
    if (example?.projectId && !example.projectId.startsWith("REPLACE_")) return example;
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Check if config has real values (not placeholders).
 */
function isConfigValid(config) {
  if (!config || typeof config !== "object") return false;
  const { apiKey, projectId } = config;
  return (
    typeof apiKey === "string" &&
    apiKey.length > 0 &&
    !apiKey.startsWith("REPLACE_") &&
    typeof projectId === "string" &&
    projectId.length > 0 &&
    !projectId.startsWith("REPLACE_")
  );
}

/**
 * Initialize Firebase. Safe to call multiple times.
 * @returns {Promise<{auth: any, db: any}|null>} auth and Firestore instances, or null if not configured
 */
export async function initFirebase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const config = await loadFirebaseConfig();
    if (!isConfigValid(config)) {
      configValid = false;
      return null;
    }
    configValid = true;

    const { initializeApp } = await import(`${CDN_BASE}/firebase-app.js`);
    const { getAuth: getFirebaseAuth } = await import(`${CDN_BASE}/firebase-auth.js`);
    const { getFirestore, enableIndexedDbPersistence } = await import(`${CDN_BASE}/firebase-firestore.js`);

    firebaseApp = initializeApp(config);
    firebaseAuth = getFirebaseAuth(firebaseApp);
    firestoreDb = getFirestore(firebaseApp);

    // Enable offline persistence (enabled by default in Firestore, but make it explicit)
    try {
      await enableIndexedDbPersistence(firestoreDb);
    } catch (err) {
      if (err?.code !== "failed-precondition" && err?.code !== "unimplemented") {
        console.warn("Firestore persistence:", err?.message);
      }
    }

    return { auth: firebaseAuth, db: firestoreDb };
  })();

  return initPromise;
}

/**
 * Whether Firebase is configured and initialized.
 */
export function isFirebaseConfigured() {
  return configValid && firestoreDb != null;
}

/**
 * Get Firestore instance. Must call initFirebase() first.
 */
export function getDb() {
  return firestoreDb;
}

/**
 * Get Auth instance. Must call initFirebase() first.
 */
export function getAuthInstance() {
  return firebaseAuth;
}

/**
 * Sign in anonymously.
 * @returns {Promise<{uid: string}|null>}
 */
export async function signInAnonymously() {
  const initialized = await initFirebase();
  if (!initialized?.auth) return null;
  const { signInAnonymously: fbSignIn } = await import(`${CDN_BASE}/firebase-auth.js`);
  const cred = await fbSignIn(firebaseAuth);
  return cred?.user ? { uid: cred.user.uid } : null;
}

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{uid: string}|null>}
 */
export async function signInWithEmailPassword(email, password) {
  const initialized = await initFirebase();
  if (!initialized?.auth) return null;
  const { signInWithEmailAndPassword } = await import(`${CDN_BASE}/firebase-auth.js`);
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return cred?.user ? { uid: cred.user.uid } : null;
}

/**
 * Create account with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{uid: string}|null>}
 */
export async function createUserWithEmailPassword(email, password) {
  const initialized = await initFirebase();
  if (!initialized?.auth) return null;
  const { createUserWithEmailAndPassword } = await import(`${CDN_BASE}/firebase-auth.js`);
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  return cred?.user ? { uid: cred.user.uid } : null;
}

/**
 * Send password reset email.
 * @param {string} email
 */
export async function sendPasswordReset(email) {
  const initialized = await initFirebase();
  if (!initialized?.auth) return;
  const { sendPasswordResetEmail } = await import(`${CDN_BASE}/firebase-auth.js`);
  await sendPasswordResetEmail(firebaseAuth, email);
}

/**
 * Send verification email for current user.
 */
export async function sendVerificationEmailForCurrentUser() {
  const initialized = await initFirebase();
  if (!initialized?.auth || !firebaseAuth?.currentUser) return false;
  const { sendEmailVerification } = await import(`${CDN_BASE}/firebase-auth.js`);
  await sendEmailVerification(firebaseAuth.currentUser);
  return true;
}

/**
 * Reload current user from Firebase auth and return shape used by UI.
 */
export async function refreshCurrentUser() {
  const initialized = await initFirebase();
  if (!initialized?.auth || !firebaseAuth?.currentUser) return null;
  const { reload } = await import(`${CDN_BASE}/firebase-auth.js`);
  await reload(firebaseAuth.currentUser);
  const user = firebaseAuth.currentUser;
  return user
    ? {
        uid: user.uid,
        email: user.email ?? null,
        isAnonymous: !!user.isAnonymous,
        emailVerified: !!user.emailVerified,
        metadata: {
          creationTime: user.metadata?.creationTime ?? null,
          lastSignInTime: user.metadata?.lastSignInTime ?? null,
        },
      }
    : null;
}

/**
 * Change password for signed-in email user.
 * Requires current password for re-auth.
 * @param {string} currentPassword
 * @param {string} nextPassword
 */
export async function changePassword(currentPassword, nextPassword) {
  const initialized = await initFirebase();
  if (!initialized?.auth || !firebaseAuth?.currentUser) return false;
  const user = firebaseAuth.currentUser;
  if (!user.email) return false;

  const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import(
    `${CDN_BASE}/firebase-auth.js`
  );
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, nextPassword);
  return true;
}

/**
 * Sign out.
 */
export async function signOut() {
  if (!firebaseAuth) return;
  const { signOut: fbSignOut } = await import(`${CDN_BASE}/firebase-auth.js`);
  await fbSignOut(firebaseAuth);
}

// --- Firestore sync ---

/**
 * Read tools from Firestore for user.
 * @param {string} uid
 * @returns {Promise<{tools: Array, updatedAt: string}|null>}
 */
export async function firestoreReadTools(uid) {
  if (!firestoreDb || !uid) return null;
  const { doc, getDoc } = await import(`${CDN_BASE}/firebase-firestore.js`);
  const docRef = doc(firestoreDb, "users", uid);
  const snapshot = await getDoc(docRef);
  const data = snapshot?.data?.();
  const tools = Array.isArray(data?.tools) ? data.tools : null;
  const updatedAt = data?.toolsUpdatedAt ?? null;
  return tools ? { tools, updatedAt } : null;
}

/**
 * Read notes from Firestore for user.
 * @param {string} uid
 * @returns {Promise<{notes: string, updatedAt: string}|null>}
 */
export async function firestoreReadNotes(uid) {
  if (!firestoreDb || !uid) return null;
  const { doc, getDoc } = await import(`${CDN_BASE}/firebase-firestore.js`);
  const docRef = doc(firestoreDb, "users", uid);
  const snapshot = await getDoc(docRef);
  const data = snapshot?.data?.();
  const notes = typeof data?.notes === "string" ? data.notes : null;
  const updatedAt = data?.notesUpdatedAt ?? null;
  return notes !== null ? { notes, updatedAt } : null;
}

/**
 * Read history from Firestore for user.
 * @param {string} uid
 * @returns {Promise<{history: Array, updatedAt: string}|null>}
 */
export async function firestoreReadHistory(uid) {
  if (!firestoreDb || !uid) return null;
  const { doc, getDoc } = await import(`${CDN_BASE}/firebase-firestore.js`);
  const docRef = doc(firestoreDb, "users", uid);
  const snapshot = await getDoc(docRef);
  const data = snapshot?.data?.();
  const history = Array.isArray(data?.history) ? data.history : null;
  const updatedAt = data?.historyUpdatedAt ?? null;
  return history ? { history, updatedAt } : null;
}

/**
 * Write tools to Firestore. Adds updatedAt to each tool.
 * @param {string} uid
 * @param {Array} tools
 */
export async function firestoreWriteTools(uid, tools) {
  if (!firestoreDb || !uid) return;
  const { doc, setDoc } = await import(`${CDN_BASE}/firebase-firestore.js`);
  const docRef = doc(firestoreDb, "users", uid);
  const now = new Date().toISOString();
  const toolsWithUpdatedAt = (tools || []).map((t) => ({ ...t, updatedAt: t.updatedAt ?? now }));
  await setDoc(docRef, { tools: toolsWithUpdatedAt, toolsUpdatedAt: now }, { merge: true });
}

/**
 * Write notes to Firestore.
 * @param {string} uid
 * @param {string} notes
 */
export async function firestoreWriteNotes(uid, notes) {
  if (!firestoreDb || !uid) return;
  const { doc, setDoc } = await import(`${CDN_BASE}/firebase-firestore.js`);
  const docRef = doc(firestoreDb, "users", uid);
  const now = new Date().toISOString();
  await setDoc(docRef, { notes: notes ?? "", notesUpdatedAt: now }, { merge: true });
}

/**
 * Write history to Firestore.
 * @param {string} uid
 * @param {Array} history
 */
export async function firestoreWriteHistory(uid, history) {
  if (!firestoreDb || !uid) return;
  const { doc, setDoc } = await import(`${CDN_BASE}/firebase-firestore.js`);
  const docRef = doc(firestoreDb, "users", uid);
  const now = new Date().toISOString();
  await setDoc(docRef, { history: history ?? [], historyUpdatedAt: now }, { merge: true });
}

/**
 * Merge two arrays by updatedAt (last-write-wins). Uses updatedAt on each item, or fallback to single timestamp.
 */
export function mergeByUpdatedAt(local, remote, localUpdatedAt, remoteUpdatedAt) {
  const localTs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
  const remoteTs = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
  if (remoteTs > localTs && Array.isArray(remote) && remote.length > 0) return remote;
  return local;
}

/**
 * Merge tools: field-level merge with conflict detection.
 * Uses the conflict-resolution module when available on window.__conflictResolution,
 * otherwise falls back to last-write-wins by doc-level updatedAt.
 */
export function mergeTools(localTools, cloudData) {
  if (!cloudData?.tools?.length) return localTools;
  try {
    const cr = window.__conflictResolution;
    if (cr && typeof cr.mergeTools === "function") {
      const result = cr.mergeTools(localTools, cloudData.tools);
      if (typeof cr.logSyncActivity === "function") {
        cr.logSyncActivity("sync_merge", result.stats);
      }
      if (typeof cr.showSyncSummaryToast === "function" && (result.stats.added || result.stats.updated)) {
        cr.showSyncSummaryToast(result.stats);
      }
      // Stash conflicts for the caller to handle via showConflictDialog
      if (result.conflicts?.length > 0) {
        window.__pendingSyncConflicts = result.conflicts;
      }
      return result.merged;
    }
  } catch {
    // Fall through to legacy merge
  }
  const cloudUpdatedAt = cloudData.updatedAt ?? "";
  const localUpdatedAt = getLatestToolUpdatedAt(localTools);
  return mergeByUpdatedAt(localTools, cloudData.tools, localUpdatedAt, cloudUpdatedAt);
}

function getLatestToolUpdatedAt(tools) {
  if (!Array.isArray(tools)) return null;
  let latest = null;
  for (const t of tools) {
    const ts = t?.updatedAt;
    if (ts && (!latest || new Date(ts).getTime() > new Date(latest).getTime())) latest = ts;
  }
  return latest;
}

/** Merge notes: last-write-wins by updatedAt. */
export function mergeNotes(localNotes, cloudData) {
  if (!cloudData) return localNotes;
  const localTs = 0; // notes don't have per-item updatedAt; use 0 so cloud wins if it has data
  const remoteTs = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
  return remoteTs > localTs && typeof cloudData.notes === "string" ? cloudData.notes : localNotes;
}

/** Merge history: last-write-wins by updatedAt. */
export function mergeHistory(localHistory, cloudData) {
  if (!cloudData?.history?.length) return localHistory;
  const remoteTs = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
  const localTs = 0;
  return remoteTs > localTs ? cloudData.history : localHistory;
}

// --- Auth ---

/**
 * Subscribe to auth state changes.
 * @param {(user: {uid: string}|null) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onAuthStateChanged(callback) {
  if (!firebaseAuth) {
    callback(null);
    return () => {};
  }
  let unsub = () => {};
  import(`${CDN_BASE}/firebase-auth.js`).then((authMod) => {
    if (!firebaseAuth) return;
    unsub = authMod.onAuthStateChanged(firebaseAuth, (user) => {
      callback(
        user
          ? {
              uid: user.uid,
              email: user.email ?? null,
              isAnonymous: !!user.isAnonymous,
              emailVerified: !!user.emailVerified,
              metadata: {
                creationTime: user.metadata?.creationTime ?? null,
                lastSignInTime: user.metadata?.lastSignInTime ?? null,
              },
            }
          : null
      );
    });
  });
  return () => {
    if (typeof unsub === "function") unsub();
  };
}
