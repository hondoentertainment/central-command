import { isValidLaunchTarget, normalizeUrl } from "./tool-model.js";

export const INTEGRATION_EVENT_KEY = "central-command.integration-events.v1";
export const CREATIVE_HUB_TOOL_ID = "integration-creative-hub";

/**
 * Declarative metadata for all supported integrations. Each entry describes how to
 * render, surface, and launch the integration. New integrations can be added by
 * extending this list without touching the open/sanitize/build plumbing.
 */
export const INTEGRATION_DEFINITIONS = [
  {
    id: "creativeHub",
    toolId: CREATIVE_HUB_TOOL_ID,
    name: "Creative Hub",
    description: "Launch your Creative Hub workspace for writing, ideation, and production.",
    category: "Writing",
    accent: "teal",
    defaultUrl: "https://creativehub.com",
    icon: "🎨",
    eventName: "creative_hub_link_opened",
  },
  {
    id: "notion",
    toolId: "integration-notion",
    name: "Notion",
    description: "Open your Notion workspace for notes, docs, and databases.",
    category: "Productivity",
    accent: "slate",
    defaultUrl: "https://www.notion.so",
    icon: "📝",
    eventName: "notion_link_opened",
  },
  {
    id: "linear",
    toolId: "integration-linear",
    name: "Linear",
    description: "Jump into Linear for issues, projects, and cycle planning.",
    category: "Productivity",
    accent: "cobalt",
    defaultUrl: "https://linear.app",
    icon: "📐",
    eventName: "linear_link_opened",
  },
  {
    id: "googleCalendar",
    toolId: "integration-google-calendar",
    name: "Google Calendar",
    description: "Check your schedule and upcoming meetings on Google Calendar.",
    category: "Productivity",
    accent: "amber",
    defaultUrl: "https://calendar.google.com",
    icon: "📅",
    eventName: "google_calendar_link_opened",
  },
];

function buildDefaultIntegrations() {
  const out = {};
  for (const def of INTEGRATION_DEFINITIONS) {
    // Only Creative Hub is enabled by default; new integrations are opt-in.
    const enabledByDefault = def.id === "creativeHub";
    out[def.id] = {
      enabled: enabledByDefault,
      url: def.defaultUrl,
      openMode: "new-tab",
      showInNav: enabledByDefault,
      showInCommandPalette: enabledByDefault,
      showAsTool: enabledByDefault,
    };
  }
  return out;
}

export const DEFAULT_INTEGRATIONS = buildDefaultIntegrations();

function getDefinition(id) {
  return INTEGRATION_DEFINITIONS.find((def) => def.id === id) || null;
}

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

function sanitizeIntegrationEntry(id, raw) {
  const def = getDefinition(id);
  const defaults = DEFAULT_INTEGRATIONS[id] ?? {
    enabled: false,
    url: def?.defaultUrl ?? "",
    openMode: "new-tab",
    showInNav: false,
    showInCommandPalette: false,
    showAsTool: false,
  };
  const input = raw && typeof raw === "object" ? raw : {};
  const validation = validateIntegrationUrl(input.url, def?.defaultUrl ?? defaults.url);

  const enabled = input.enabled !== undefined ? !!input.enabled : defaults.enabled;

  return {
    enabled,
    url: validation.isValid ? validation.url : def?.defaultUrl ?? defaults.url,
    openMode: normalizeOpenMode(input.openMode ?? defaults.openMode),
    showInNav: input.showInNav !== undefined ? !!input.showInNav : defaults.showInNav,
    showInCommandPalette:
      input.showInCommandPalette !== undefined
        ? !!input.showInCommandPalette
        : defaults.showInCommandPalette,
    showAsTool: input.showAsTool !== undefined ? !!input.showAsTool : defaults.showAsTool,
  };
}

export function sanitizeIntegrationsPreferences(value) {
  const input = value && typeof value === "object" ? value : {};
  const out = {};
  for (const def of INTEGRATION_DEFINITIONS) {
    out[def.id] = sanitizeIntegrationEntry(def.id, input[def.id]);
  }
  return out;
}

export function getIntegrationConfig(preferences, id) {
  return sanitizeIntegrationsPreferences(preferences)[id] ?? null;
}

export function getCreativeHubConfig(preferences) {
  return getIntegrationConfig(preferences, "creativeHub");
}

export function isIntegrationConfigured(config) {
  return !!config?.enabled && isValidLaunchTarget(config?.url || "");
}

export function isCreativeHubConfigured(config) {
  return isIntegrationConfigured(config);
}

/**
 * Returns all integrations as [{ id, definition, config }] in declaration order.
 */
export function listIntegrations(preferences) {
  const prefs = sanitizeIntegrationsPreferences(preferences);
  return INTEGRATION_DEFINITIONS.map((def) => ({
    id: def.id,
    definition: def,
    config: prefs[def.id],
  }));
}

export function openIntegration(
  config,
  definition,
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
  if (!isIntegrationConfigured(config)) {
    onError(`${definition?.name ?? "Integration"} link is not configured.`);
    return false;
  }

  const url = normalizeUrl(config.url);

  if (config.openMode === "same-tab") {
    setLocation(url);
  } else {
    const opened = openWindow(url, "_blank", "noreferrer");
    if (opened === null) {
      onError(
        `Your browser blocked the ${definition?.name ?? "integration"} pop-up. Allow pop-ups or switch to same-tab mode.`
      );
      return false;
    }
  }

  trackEvent(definition?.eventName ?? "integration_link_opened", {
    integrationId: definition?.id,
    source,
    signedIn: !!isSignedIn,
    openMode: config.openMode,
    url,
  });

  return true;
}

export function openCreativeHub(config, options = {}) {
  return openIntegration(config, getDefinition("creativeHub"), options);
}

export function buildIntegrationTool(config, definition) {
  if (!isIntegrationConfigured(config) || !config.showAsTool || !definition) return null;
  return {
    id: definition.toolId,
    name: definition.name,
    url: config.url,
    category: definition.category,
    description: definition.description,
    accent: definition.accent,
    surfaces: ["hero"],
    iconKey: "auto",
    openMode: config.openMode,
  };
}

export function buildCreativeHubTool(config) {
  return buildIntegrationTool(config, getDefinition("creativeHub"));
}

/**
 * Returns an array of tool objects for every integration whose config enables
 * the tool surface. Useful for seeding the tool deck with virtual entries.
 */
export function buildIntegrationTools(preferences) {
  return listIntegrations(preferences)
    .map(({ config, definition }) => buildIntegrationTool(config, definition))
    .filter(Boolean);
}

/**
 * Performs a lightweight health check on an integration URL via a HEAD request.
 * Returns { ok: true } if reachable, or { ok: false, message } if not.
 * @param {string} url
 * @param {number} [timeout=5000]
 * @returns {Promise<{ok: boolean, message?: string}>}
 */
export async function checkIntegrationHealth(url, timeout = 5000) {
  if (!url || typeof url !== "string") {
    return { ok: false, message: "No URL provided." };
  }
  const normalized = normalizeUrl(url);
  if (!isValidLaunchTarget(normalized)) {
    return { ok: false, message: "URL is not a valid launch target." };
  }
  try {
    const controller = new globalThis.AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    await fetch(normalized, {
      method: "HEAD",
      mode: "no-cors",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: true };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { ok: false, message: "Request timed out. The URL may be slow or unreachable." };
    }
    return { ok: false, message: "Could not reach URL. It may be offline or blocked by CORS." };
  }
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
