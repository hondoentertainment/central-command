import { isValidLaunchTarget, normalizeUrl } from "./tool-model.js";

export const DEFAULT_INTEGRATIONS = {
  creativeHub: {
    enabled: true,
    url: "https://creativehub.com",
    openMode: "new-tab",
    showInNav: true,
    showInCommandPalette: true,
    showAsTool: true,
  },
};

function normalizeOpenMode(value) {
  return value === "same-tab" ? "same-tab" : "new-tab";
}

export function sanitizeIntegrationsPreferences(value) {
  const input = value && typeof value === "object" ? value : {};
  const creativeHub = input.creativeHub && typeof input.creativeHub === "object" ? input.creativeHub : {};
  const rawUrl = typeof creativeHub.url === "string" ? creativeHub.url.trim() : DEFAULT_INTEGRATIONS.creativeHub.url;
  const normalizedUrl = normalizeUrl(rawUrl);

  return {
    creativeHub: {
      enabled: creativeHub.enabled !== false,
      url: isValidLaunchTarget(normalizedUrl) ? normalizedUrl : DEFAULT_INTEGRATIONS.creativeHub.url,
      openMode: normalizeOpenMode(creativeHub.openMode),
      showInNav: creativeHub.showInNav !== false,
      showInCommandPalette: creativeHub.showInCommandPalette !== false,
      showAsTool: creativeHub.showAsTool !== false,
    },
  };
}

export function getCreativeHubConfig(preferences) {
  return sanitizeIntegrationsPreferences(preferences).creativeHub;
}

export function isCreativeHubConfigured(config) {
  return !!config?.enabled && isValidLaunchTarget(config?.url || "");
}

export function openCreativeHub(config, { source = "unknown", openWindow = window.open, setLocation = (url) => {
  window.location.href = url;
}, trackEvent = () => {} } = {}) {
  if (!isCreativeHubConfigured(config)) return false;

  const url = normalizeUrl(config.url);
  if (config.openMode === "same-tab") setLocation(url);
  else openWindow(url, "_blank", "noreferrer");

  trackEvent("creative_hub_link_opened", {
    source,
    openMode: config.openMode,
    url,
  });

  return true;
}

export function buildCreativeHubTool(config) {
  if (!isCreativeHubConfigured(config) || !config.showAsTool) return null;
  return {
    name: "Creative Hub",
    url: config.url,
    category: "Writing",
    description: "Launch your Creative Hub workspace for writing, ideation, and production.",
    accent: "teal",
    surfaces: ["hero"],
    iconKey: "auto",
    openMode: config.openMode,
  };
}

export function trackIntegrationEvent(eventName, payload, maxEvents = 100) {
  try {
    const key = "central-command.integration-events.v1";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const safe = Array.isArray(existing) ? existing : [];
    safe.push({ eventName, payload, createdAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(safe.slice(-maxEvents)));
  } catch {
    // no-op
  }
}
