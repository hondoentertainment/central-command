import assert from "node:assert";

// Mock localStorage before importing storage
const store = {};
const mockStorage = {
  getItem(key) {
    return store[key] ?? null;
  },
  setItem(key, value) {
    store[key] = String(value);
  },
  removeItem(key) {
    delete store[key];
  },
  clear() {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

global.localStorage = mockStorage;

// Dynamic import after mock is set - storage uses firebase which may fail in Node.
// We'll test only the parts that don't need Firebase.
const {
  STORAGE_KEYS,
  loadCustomCategories,
  saveCustomCategories,
  loadLayoutPreference,
  saveLayoutPreference,
  loadIntegrationsPreferences,
  saveIntegrationsPreferences,
  loadSecurityEvents,
  recordSecurityEvent,
  loadRunbookTemplates,
  saveRunbookTemplates,
  loadNotesMeta,
} = await import(
  "../lib/storage.js"
);

// Reset before each test
mockStorage.clear();

// --- loadCustomCategories / saveCustomCategories ---
assert.deepStrictEqual(loadCustomCategories(), []);
saveCustomCategories(["A", "B"]);
assert.deepStrictEqual(loadCustomCategories(), ["A", "B"]);
saveCustomCategories(["X"]);
assert.deepStrictEqual(loadCustomCategories(), ["X"]);
saveCustomCategories([]);
assert.deepStrictEqual(loadCustomCategories(), []);
saveCustomCategories(["A", "  ", "B"]);
assert.deepStrictEqual(loadCustomCategories(), ["A", "B"]);

// --- loadLayoutPreference / saveLayoutPreference ---
assert.strictEqual(loadLayoutPreference(), "grid");
saveLayoutPreference("list");
assert.strictEqual(loadLayoutPreference(), "list");
saveLayoutPreference("compact");
assert.strictEqual(loadLayoutPreference(), "compact");
saveLayoutPreference("invalid");
assert.strictEqual(loadLayoutPreference(), "grid");



// --- integrations prefs ---
assert.strictEqual(loadIntegrationsPreferences(), null);
saveIntegrationsPreferences({ creativeHub: { url: "https://example.com", enabled: true } });
assert.deepStrictEqual(loadIntegrationsPreferences(), { creativeHub: { url: "https://example.com", enabled: true } });

// --- security events ---
assert.deepStrictEqual(loadSecurityEvents(), []);
recordSecurityEvent("login_success", { method: "email" });
recordSecurityEvent("password_reset_requested");
const events = loadSecurityEvents();
assert.strictEqual(events.length, 2);
assert.strictEqual(events[0].type, "password_reset_requested");
assert.strictEqual(events[1].type, "login_success");
assert.strictEqual(events[1].details.method, "email");

// --- loadRunbookTemplates / saveRunbookTemplates ---
assert.deepStrictEqual(loadRunbookTemplates(), []);
saveRunbookTemplates([
  { id: "t1", name: "Template A", content: "Steps here" },
  { id: "t2", name: "Template B", content: "More steps" },
]);
const templates = loadRunbookTemplates();
assert.strictEqual(templates.length, 2);
assert.strictEqual(templates[0].name, "Template A");
saveRunbookTemplates([{ id: "x", name: "Valid" }, { id: "y", name: "No content" }]);
assert.strictEqual(loadRunbookTemplates().length, 0);
saveRunbookTemplates([{ id: "z", name: "Z", content: "z" }]);
assert.strictEqual(loadRunbookTemplates().length, 1);

// --- loadNotesMeta ---
assert.strictEqual(loadNotesMeta(), null);
mockStorage.setItem(
  "central-command.notes-meta",
  JSON.stringify({ lastEdited: "2025-01-15T12:00:00.000Z" })
);
const meta = loadNotesMeta();
assert.ok(meta);
assert.strictEqual(meta.lastEdited, "2025-01-15T12:00:00.000Z");

// --- STORAGE_KEYS ---
assert.ok(STORAGE_KEYS.tools);
assert.ok(STORAGE_KEYS.customCategories);
assert.ok(STORAGE_KEYS.layout);
assert.ok(STORAGE_KEYS.integrations);
assert.ok(STORAGE_KEYS.securityEvents);

console.log("storage.test.js: all assertions passed");
export default { ok: true };
