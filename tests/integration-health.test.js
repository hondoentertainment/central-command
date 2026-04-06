import assert from "node:assert";
import { checkIntegrationHealth } from "../lib/integrations.js";

const store = {};
global.localStorage = {
  getItem(key) { return store[key] ?? null; },
  setItem(key, value) { store[key] = String(value); },
  removeItem(key) { delete store[key]; },
  clear() { Object.keys(store).forEach((k) => delete store[k]); },
};

// Test with no URL
const noUrl = await checkIntegrationHealth("");
assert.strictEqual(noUrl.ok, false);
assert.ok(noUrl.message.includes("No URL"));

const nullUrl = await checkIntegrationHealth(null);
assert.strictEqual(nullUrl.ok, false);

// Test with invalid URL
const invalidUrl = await checkIntegrationHealth("not a url");
assert.strictEqual(invalidUrl.ok, false);
assert.ok(invalidUrl.message.includes("not a valid"));

// Test with valid URL and successful fetch
global.AbortController = class {
  constructor() { this.signal = {}; }
  abort() {}
};

global.fetch = () => Promise.resolve({ ok: true });
const success = await checkIntegrationHealth("https://example.com");
assert.strictEqual(success.ok, true);

// Test with fetch failure
global.fetch = () => Promise.reject(new Error("network"));
const failure = await checkIntegrationHealth("https://example.com");
assert.strictEqual(failure.ok, false);
assert.ok(failure.message.includes("Could not reach"));

// Test with abort error
global.fetch = () => {
  const err = new Error("aborted");
  err.name = "AbortError";
  return Promise.reject(err);
};
const aborted = await checkIntegrationHealth("https://example.com");
assert.strictEqual(aborted.ok, false);
assert.ok(aborted.message.includes("timed out"));

console.log("integration-health.test.js: all assertions passed");
export default { ok: true };
