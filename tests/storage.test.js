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
const { STORAGE_KEYS, loadCustomCategories, saveCustomCategories, loadLayoutPreference, saveLayoutPreference, loadIntegrationsPreferences, saveIntegrationsPreferences } = await import(
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

// --- STORAGE_KEYS ---
assert.ok(STORAGE_KEYS.tools);
assert.ok(STORAGE_KEYS.customCategories);
assert.ok(STORAGE_KEYS.layout);
assert.ok(STORAGE_KEYS.integrations);

console.log("storage.test.js: all assertions passed");
export default { ok: true };
