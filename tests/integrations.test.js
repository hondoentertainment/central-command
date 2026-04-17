import assert from "node:assert";
import {
  CREATIVE_HUB_TOOL_ID,
  DEFAULT_INTEGRATIONS,
  INTEGRATION_DEFINITIONS,
  INTEGRATION_EVENT_KEY,
  sanitizeIntegrationsPreferences,
  getCreativeHubConfig,
  getIntegrationConfig,
  isCreativeHubConfigured,
  isIntegrationConfigured,
  listIntegrations,
  openCreativeHub,
  openIntegration,
  buildCreativeHubTool,
  buildIntegrationTool,
  buildIntegrationTools,
  trackIntegrationEvent,
  validateIntegrationUrl,
} from "../lib/integrations.js";

const store = {};
global.localStorage = {
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

const defaults = sanitizeIntegrationsPreferences(null);
assert.deepStrictEqual(defaults.creativeHub, DEFAULT_INTEGRATIONS.creativeHub);

const valid = validateIntegrationUrl("creativehub.local");
assert.strictEqual(valid.url, "https://creativehub.local");
assert.strictEqual(valid.isValid, true);
const invalid = validateIntegrationUrl("not a url");
assert.strictEqual(invalid.isValid, false);

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
  isSignedIn: true,
  openWindow: (url, target) => {
    opened = { url, target };
    return { closed: false };
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
assert.strictEqual(tracked?.payload?.signedIn, true);

opened = null;
relocated = null;
openCreativeHub(
  { ...defaults.creativeHub, openMode: "same-tab" },
  {
    setLocation: (url) => {
      relocated = url;
    },
    openWindow: () => {
      opened = true;
    },
    trackEvent: () => {},
  }
);
assert.strictEqual(relocated, defaults.creativeHub.url);
assert.strictEqual(opened, null);

let errorMessage = "";
const blocked = openCreativeHub(defaults.creativeHub, {
  openWindow: () => null,
  trackEvent: () => {
    throw new Error("trackEvent should not run when popup is blocked");
  },
  onError: (message) => {
    errorMessage = message;
  },
});
assert.strictEqual(blocked, false);
assert.ok(errorMessage.includes("blocked"));

const tool = buildCreativeHubTool(defaults.creativeHub);
assert.strictEqual(tool?.name, "Creative Hub");
assert.strictEqual(tool?.id, CREATIVE_HUB_TOOL_ID);
assert.strictEqual(buildCreativeHubTool({ ...defaults.creativeHub, showAsTool: false }), null);

localStorage.clear();
trackIntegrationEvent("creative_hub_link_opened", { source: "command" }, 2);
trackIntegrationEvent("creative_hub_link_opened", { source: "nav" }, 2);
trackIntegrationEvent("creative_hub_link_opened", { source: "hero" }, 2);
const events = JSON.parse(localStorage.getItem(INTEGRATION_EVENT_KEY));
assert.strictEqual(events.length, 2);
assert.strictEqual(events[0].payload.source, "nav");
assert.strictEqual(events[1].payload.source, "hero");

// --- Multi-integration plumbing ---

// Definitions include the new integrations and stay stable by id.
const definitionIds = INTEGRATION_DEFINITIONS.map((d) => d.id).sort();
assert.deepStrictEqual(
  definitionIds,
  ["creativeHub", "googleCalendar", "linear", "notion"],
  "known integration ids"
);

// Defaults: creativeHub opt-in, others opt-out.
const freshDefaults = sanitizeIntegrationsPreferences(null);
assert.strictEqual(freshDefaults.creativeHub.enabled, true);
assert.strictEqual(freshDefaults.notion.enabled, false);
assert.strictEqual(freshDefaults.linear.enabled, false);
assert.strictEqual(freshDefaults.googleCalendar.enabled, false);

// Enabling a new integration flips it through the generic helpers.
const withNotion = sanitizeIntegrationsPreferences({
  notion: { enabled: true, showAsTool: true, url: "example.com" },
});
assert.strictEqual(withNotion.notion.enabled, true);
assert.strictEqual(withNotion.notion.url, "https://example.com");
assert.strictEqual(isIntegrationConfigured(getIntegrationConfig(withNotion, "notion")), true);

const entries = listIntegrations(withNotion);
const notionEntry = entries.find((e) => e.id === "notion");
assert.ok(notionEntry, "notion should be listed");
assert.strictEqual(notionEntry.definition.name, "Notion");

// buildIntegrationTools only emits tools where showAsTool is true.
const tools = buildIntegrationTools(withNotion);
const toolNames = tools.map((t) => t.name).sort();
assert.ok(toolNames.includes("Notion"), "notion tool should build when enabled with showAsTool");

// openIntegration uses definition event name.
let openedEvent = null;
openIntegration(
  notionEntry.config,
  notionEntry.definition,
  {
    openWindow: () => ({ closed: false }),
    setLocation: () => {},
    trackEvent: (name, payload) => {
      openedEvent = { name, payload };
    },
  }
);
assert.strictEqual(openedEvent?.name, "notion_link_opened");
assert.strictEqual(openedEvent?.payload?.integrationId, "notion");

// buildIntegrationTool returns null when definition is missing.
assert.strictEqual(buildIntegrationTool(notionEntry.config, null), null);

// --- Telemetry aggregation ---

const { aggregateIntegrationEvents, readIntegrationEvents, clearIntegrationEvents } = await import(
  "../lib/integrations.js"
);

localStorage.clear();
const emptyAgg = aggregateIntegrationEvents();
assert.ok(Array.isArray(emptyAgg));
assert.strictEqual(emptyAgg.length, INTEGRATION_DEFINITIONS.length);
assert.ok(emptyAgg.every((row) => row.opens === 0));

// New-style events carry integrationId on the payload.
trackIntegrationEvent("notion_link_opened", { integrationId: "notion", source: "nav" });
trackIntegrationEvent("notion_link_opened", { integrationId: "notion", source: "palette" });
trackIntegrationEvent("linear_link_opened", { integrationId: "linear", source: "palette" });

// Legacy events (pre-generalization) still count via eventName reverse-map.
trackIntegrationEvent("creative_hub_link_opened", { source: "hero" });

const agg = aggregateIntegrationEvents();
const byId = new Map(agg.map((row) => [row.id, row]));
assert.strictEqual(byId.get("notion").opens, 2);
assert.strictEqual(byId.get("notion").lastSource, "palette");
assert.strictEqual(byId.get("linear").opens, 1);
assert.strictEqual(byId.get("creativeHub").opens, 1);
assert.strictEqual(byId.get("googleCalendar").opens, 0);

// Rows come back in INTEGRATION_DEFINITIONS order.
assert.deepStrictEqual(
  agg.map((r) => r.id),
  INTEGRATION_DEFINITIONS.map((d) => d.id)
);

assert.ok(readIntegrationEvents().length >= 3, "events are readable");

clearIntegrationEvents();
assert.strictEqual(readIntegrationEvents().length, 0);
assert.ok(aggregateIntegrationEvents().every((row) => row.opens === 0));

console.log("integrations.test.js: all assertions passed");
export default { ok: true };
