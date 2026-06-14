import { isValidLaunchTarget, normalizeUrl } from "./tool-model.js";

export const INTEGRATION_EVENT_KEY = "central-command.integration-events.v1";
export const CREATIVE_HUB_TOOL_ID = "integration-creative-hub";

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

export function validateIntegrationUrl(rawUrl, fallbackUrl = DEFAULT_INTEGRATIONS.creativeHub.url) {
  const candidate = typeof rawUrl === "string" && rawUrl.trim() ? rawUrl.trim() : fallbackUrl;
  const normalized = normalizeUrl(candidate);
  return {
    url: normalized,
    isValid: isValidLaunchTarget(normalized),
  };
}

export function sanitizeIntegrationsPreferences(value) {
  const input = value && typeof value === "object" ? value : {};
  const creativeHub = input.creativeHub && typeof input.creativeHub === "object" ? input.creativeHub : {};
  const validation = validateIntegrationUrl(creativeHub.url);

  return {
    creativeHub: {
      enabled: creativeHub.enabled !== false,
      url: validation.isValid ? validation.url : DEFAULT_INTEGRATIONS.creativeHub.url,
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

export function openCreativeHub(
  config,
  {
    source = "unknown",
    isSignedIn = false,
    openWindow = window.open,
    setLocation = (url) => {
      window.location.href = url;
    },
    trackEvent = () => {},
    onError = () => {},
  } = {}
) {
  if (!isCreativeHubConfigured(config)) {
    onError("Creative Hub link is not configured.");
    return false;
  }

  const url = normalizeUrl(config.url);

  if (config.openMode === "same-tab") {
    setLocation(url);
  } else {
    const opened = openWindow(url, "_blank", "noreferrer");
    if (opened === null) {
      onError("Your browser blocked the Creative Hub pop-up. Allow pop-ups or switch to same-tab mode.");
      return false;
    }
  }

  trackEvent("creative_hub_link_opened", {
    source,
    signedIn: !!isSignedIn,
    openMode: config.openMode,
    url,
  });

  return true;
}

export function buildCreativeHubTool(config) {
  if (!isCreativeHubConfigured(config) || !config.showAsTool) return null;
  return {
    id: CREATIVE_HUB_TOOL_ID,
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
    const existing = JSON.parse(localStorage.getItem(INTEGRATION_EVENT_KEY) || "[]");
    const safe = Array.isArray(existing) ? existing : [];
    safe.push({ eventName, payload, createdAt: new Date().toISOString() });
    localStorage.setItem(INTEGRATION_EVENT_KEY, JSON.stringify(safe.slice(-maxEvents)));
  } catch {
    // no-op
  }
}
