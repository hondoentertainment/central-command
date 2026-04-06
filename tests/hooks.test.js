import assert from "node:assert";
import { loadLaunchHookUrl, saveLaunchHookUrl, fireLaunchHook } from "../lib/hooks.js";

const store = {};
global.localStorage = {
  getItem(key) { return store[key] ?? null; },
  setItem(key, value) { store[key] = String(value); },
  removeItem(key) { delete store[key]; },
  clear() { Object.keys(store).forEach((k) => delete store[k]); },
};

// Test loadLaunchHookUrl with no stored value
localStorage.clear();
assert.strictEqual(loadLaunchHookUrl(), "");

// Test saveLaunchHookUrl and loadLaunchHookUrl
assert.strictEqual(saveLaunchHookUrl("https://example.com/hook"), true);
assert.strictEqual(loadLaunchHookUrl(), "https://example.com/hook");

// Test saveLaunchHookUrl trims whitespace
saveLaunchHookUrl("  https://example.com/trimmed  ");
assert.strictEqual(loadLaunchHookUrl(), "https://example.com/trimmed");

// Test saveLaunchHookUrl with empty string removes key
saveLaunchHookUrl("");
assert.strictEqual(loadLaunchHookUrl(), "");
assert.strictEqual(localStorage.getItem("central-command.launch-hook-url"), null);

// Test saveLaunchHookUrl with whitespace-only removes key
saveLaunchHookUrl("   ");
assert.strictEqual(loadLaunchHookUrl(), "");

// Test fireLaunchHook with no URL set does not throw
localStorage.clear();
fireLaunchHook({ toolId: "t1", toolName: "Test", url: "https://test.com" });

// Test fireLaunchHook with URL set (mock fetch)
let fetchCalled = false;
let fetchArgs = null;
global.fetch = (url, opts) => {
  fetchCalled = true;
  fetchArgs = { url, opts };
  return Promise.resolve({ ok: true });
};

saveLaunchHookUrl("https://hook.example.com");
fireLaunchHook({ toolId: "t1", toolName: "Test Tool", url: "https://test.com" });

// Give the fire-and-forget a moment
await new Promise((r) => setTimeout(r, 50));
assert.strictEqual(fetchCalled, true);
assert.strictEqual(fetchArgs.url, "https://hook.example.com");
assert.strictEqual(fetchArgs.opts.method, "POST");
const body = JSON.parse(fetchArgs.opts.body);
assert.strictEqual(body.toolId, "t1");
assert.strictEqual(body.toolName, "Test Tool");
assert.strictEqual(body.url, "https://test.com");
assert.ok(body.timestamp);

// Test fireLaunchHook with fetch failure does not throw
global.fetch = () => Promise.reject(new Error("network error"));
fireLaunchHook({ toolId: "t2", toolName: "Fail", url: "https://fail.com" });
await new Promise((r) => setTimeout(r, 50));

console.log("hooks.test.js: all assertions passed");
export default { ok: true };
