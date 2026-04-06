import assert from "node:assert";

const store = {};
global.localStorage = {
  getItem(key) { return store[key] ?? null; },
  setItem(key, value) { store[key] = String(value); },
  removeItem(key) { delete store[key]; },
  clear() { Object.keys(store).forEach((k) => delete store[k]); },
};

// Minimal DOM shim for surfaces-settings module
global.document = {
  querySelector() { return null; },
  createElement(tag) { return { tagName: tag, textContent: "", innerHTML: "", className: "" }; },
};
global.window = { location: { pathname: "/", href: "" }, dispatchEvent() {}, addEventListener() {} };

import {
  getSurfacesForPage,
  getIntegrationPrefs,
} from "../lib/surfaces-settings.js";

// getSurfacesForPage returns defaults when nothing stored
localStorage.clear();
const defaultSurfaces = getSurfacesForPage("command");
assert.deepStrictEqual(defaultSurfaces, ["hero", "spotlight"]);

// getSurfacesForPage returns defaults for unknown page
const unknownPage = getSurfacesForPage("unknown-page");
assert.deepStrictEqual(unknownPage, ["hero", "spotlight"]);

// getSurfacesForPage reads from storage
localStorage.setItem("central-command.surfaces", JSON.stringify({ command: ["spotlight"] }));
const customSurfaces = getSurfacesForPage("command");
assert.deepStrictEqual(customSurfaces, ["spotlight"]);

// getIntegrationPrefs returns sanitized defaults when nothing stored
localStorage.clear();
const integrationPrefs = getIntegrationPrefs();
assert.strictEqual(integrationPrefs.creativeHub.enabled, true);
assert.strictEqual(integrationPrefs.creativeHub.openMode, "new-tab");
assert.strictEqual(typeof integrationPrefs.creativeHub.url, "string");

// getIntegrationPrefs reads custom values
localStorage.setItem(
  "central-command.integrations",
  JSON.stringify({ creativeHub: { enabled: false, openMode: "same-tab" } })
);
const customIntPrefs = getIntegrationPrefs();
assert.strictEqual(customIntPrefs.creativeHub.enabled, false);
assert.strictEqual(customIntPrefs.creativeHub.openMode, "same-tab");

console.log("surfaces-settings.test.js: all assertions passed");
export default { ok: true };
