import assert from "node:assert";
import {
  DEFAULT_INTEGRATIONS,
  sanitizeIntegrationsPreferences,
  getCreativeHubConfig,
  isCreativeHubConfigured,
  openCreativeHub,
  buildCreativeHubTool,
  trackIntegrationEvent,
} from "../lib/integrations.js";

const store = {};
global.localStorage = {
  getItem(key) {
    return store[key] ?? null;
  },
  setItem(key, value) {
    store[key] = String(value);
  },
  clear() {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

const defaults = sanitizeIntegrationsPreferences(null);
assert.deepStrictEqual(defaults.creativeHub, DEFAULT_INTEGRATIONS.creativeHub);

const custom = sanitizeIntegrationsPreferences({
  creativeHub: {
    enabled: false,
    url: "creativehub.local",
    openMode: "same-tab",
    showInNav: false,
    showInCommandPalette: false,
    showAsTool: false,
  },
});
assert.strictEqual(custom.creativeHub.enabled, false);
assert.strictEqual(custom.creativeHub.url, "https://creativehub.local");
assert.strictEqual(custom.creativeHub.openMode, "same-tab");
assert.strictEqual(custom.creativeHub.showInNav, false);

const config = getCreativeHubConfig(custom);
assert.strictEqual(isCreativeHubConfigured(config), false);
assert.strictEqual(isCreativeHubConfigured(defaults.creativeHub), true);

let opened = null;
let relocated = null;
let tracked = null;
const openedNewTab = openCreativeHub(defaults.creativeHub, {
  source: "test",
  openWindow: (url, target) => {
    opened = { url, target };
  },
  setLocation: (url) => {
    relocated = url;
  },
  trackEvent: (name, payload) => {
    tracked = { name, payload };
  },
});
assert.strictEqual(openedNewTab, true);
assert.strictEqual(opened?.url, defaults.creativeHub.url);
assert.strictEqual(relocated, null);
assert.strictEqual(tracked?.name, "creative_hub_link_opened");

opened = null;
relocated = null;
tracked = null;
openCreativeHub({ ...defaults.creativeHub, openMode: "same-tab" }, {
  setLocation: (url) => {
    relocated = url;
  },
  openWindow: () => {
    opened = true;
  },
  trackEvent: () => {},
});
assert.strictEqual(relocated, defaults.creativeHub.url);
assert.strictEqual(opened, null);

const tool = buildCreativeHubTool(defaults.creativeHub);
assert.strictEqual(tool?.name, "Creative Hub");
assert.strictEqual(buildCreativeHubTool({ ...defaults.creativeHub, showAsTool: false }), null);

localStorage.clear();
trackIntegrationEvent("creative_hub_link_opened", { source: "command" }, 2);
trackIntegrationEvent("creative_hub_link_opened", { source: "nav" }, 2);
trackIntegrationEvent("creative_hub_link_opened", { source: "hero" }, 2);
const events = JSON.parse(localStorage.getItem("central-command.integration-events.v1"));
assert.strictEqual(events.length, 2);
assert.strictEqual(events[0].payload.source, "nav");
assert.strictEqual(events[1].payload.source, "hero");

console.log("integrations.test.js: all assertions passed");
export default { ok: true };
