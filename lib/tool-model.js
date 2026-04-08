// @ts-check

import { ICON_OPTIONS } from "./icons.js";

/**
 * @typedef {"hero"|"spotlight"} Surface
 */

/**
 * @typedef {"amber"|"teal"|"crimson"|"cobalt"} Accent
 */

/**
 * @typedef {"new-tab"|"same-tab"} OpenMode
 */

/**
 * @typedef {Object} Tool
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - Display name
 * @property {string} url - Launch URL or path
 * @property {string} category - Category label
 * @property {string} description - Short description
 * @property {Accent} accent - Color accent key
 * @property {boolean} pinned - Whether the tool is pinned
 * @property {number|null} pinRank - Sort rank among pinned tools (null if unpinned)
 * @property {Surface[]} surfaces - Surfaces this tool appears on
 * @property {string} iconKey - Icon identifier from ICON_OPTIONS
 * @property {string} [iconUrl] - Custom icon URL (only when iconKey is "custom")
 * @property {string} shortcutLabel - Keyboard shortcut label (max 16 chars)
 * @property {OpenMode} openMode - How the tool opens
 * @property {string} [updatedAt] - ISO timestamp of last update (added during sync)
 */

/**
 * @typedef {Object} HistoryEntry
 * @property {string} toolId - ID of the launched tool
 * @property {string} launchedAt - ISO timestamp of the launch
 * @property {number} count - Cumulative launch count
 */

/** @type {readonly Surface[]} */
export const SURFACES = ["hero", "spotlight"];
/** @type {readonly Accent[]} */
export const ACCENTS = ["amber", "teal", "crimson", "cobalt"];
/** @type {readonly OpenMode[]} */
export const OPEN_MODES = ["new-tab", "same-tab"];

/** @type {Set<string>} */
const ICON_KEYS = new Set(ICON_OPTIONS.map((option) => option.value));

/**
 * Collapse consecutive whitespace into a single space and trim.
 * @param {*} value - Any value; coerced to string
 * @returns {string}
 */
export function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Filter and deduplicate an array of surface values.
 * @param {*} value - Candidate array of surface strings
 * @returns {Surface[]}
 */
export function sanitizeSurfaces(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((surface) => SURFACES.includes(surface)))];
}

/**
 * Compute a deduplication signature from a tool's name and URL.
 * @param {Partial<Tool>} tool
 * @returns {string}
 */
export function getToolSignature(tool) {
  const name = collapseWhitespace(tool?.name).toLowerCase();
  const url = collapseWhitespace(tool?.url).toLowerCase();
  return `${name}|${url}`;
}

/**
 * Validate and normalise a raw tool object, filling gaps from fallback.
 * @param {*} tool - Raw tool-like object
 * @param {Partial<Tool>} [fallback={}] - Fallback values for missing fields
 * @returns {Tool|null} Sanitised tool or null if required fields are missing
 */
export function sanitizeTool(tool, fallback = {}) {
  if (!tool || typeof tool !== "object") return null;

  const name = collapseWhitespace(tool.name ?? fallback.name);
  const url = collapseWhitespace(tool.url ?? fallback.url);
  const category = collapseWhitespace(tool.category ?? fallback.category);
  const description = collapseWhitespace(tool.description ?? fallback.description);

  if (!name || !url || !category || !description) return null;

  const pinned = Boolean(tool.pinned ?? fallback.pinned);
  const rawPinRank = Number(tool.pinRank ?? fallback.pinRank);
  const accent = ACCENTS.includes(tool.accent) ? tool.accent : fallback.accent;
  const openMode = OPEN_MODES.includes(tool.openMode) ? tool.openMode : fallback.openMode;
  const iconKey = ICON_KEYS.has(tool.iconKey) ? tool.iconKey : fallback.iconKey;
  const iconUrl =
    iconKey === "custom" && typeof tool?.iconUrl === "string" && /^https?:\/\/\S+$/i.test(tool.iconUrl.trim())
      ? tool.iconUrl.trim()
      : undefined;

  const result = {
    id: typeof tool.id === "string" && tool.id.trim() ? tool.id : crypto.randomUUID(),
    name,
    url,
    category,
    description,
    accent: ACCENTS.includes(accent) ? accent : "amber",
    pinned,
    pinRank: pinned && Number.isFinite(rawPinRank) ? rawPinRank : null,
    surfaces: sanitizeSurfaces(tool.surfaces ?? fallback.surfaces),
    iconKey: ICON_KEYS.has(iconKey) ? iconKey : "auto",
    shortcutLabel: collapseWhitespace(tool.shortcutLabel ?? fallback.shortcutLabel).slice(0, 16),
    openMode: OPEN_MODES.includes(openMode) ? openMode : "new-tab",
  };
  if (iconUrl) result.iconUrl = iconUrl;
  return result;
}

/**
 * Hydrate raw tool data into a validated, pin-rank-normalised array.
 * @param {*} value - Raw stored tool array
 * @param {Map<string, Partial<Tool>>} fallbackMetadataBySignature - Fallback metadata keyed by signature
 * @returns {Tool[]}
 */
export function hydrateTools(value, fallbackMetadataBySignature) {
  if (!Array.isArray(value)) return [];

  return normalizePinRanks(
    value
      .map((tool) => {
        const fallback = fallbackMetadataBySignature.get(getToolSignature(tool)) ?? {};
        return sanitizeTool(tool, fallback);
      })
      .filter(Boolean)
  );
}

/**
 * Sort tools: pinned first (by pinRank), then alphabetically by name.
 * @param {Tool[]} tools
 * @returns {Tool[]}
 */
export function sortTools(tools) {
  return [...tools].sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
    if (a.pinned && b.pinned) {
      const aRank = Number.isFinite(a.pinRank) ? a.pinRank : Number.MAX_SAFE_INTEGER;
      const bRank = Number.isFinite(b.pinRank) ? b.pinRank : Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Re-number pinRank values so they are contiguous starting at 1.
 * @param {Tool[]} tools
 * @returns {Tool[]}
 */
export function normalizePinRanks(tools) {
  const sortedPinnedIds = sortTools(tools)
    .filter((tool) => tool.pinned)
    .map((tool) => tool.id);

  const rankMap = new Map(sortedPinnedIds.map((id, index) => [id, index + 1]));

  return tools.map((tool) => ({
    ...tool,
    pinRank: tool.pinned ? rankMap.get(tool.id) ?? sortedPinnedIds.length + 1 : null,
  }));
}

/**
 * Return the next available pinRank (one greater than the current maximum).
 * @param {Tool[]} tools
 * @returns {number}
 */
export function getNextPinRank(tools) {
  const maxRank = tools.reduce((highest, tool) => {
    if (!tool.pinned || !Number.isFinite(tool.pinRank)) return highest;
    return Math.max(highest, tool.pinRank);
  }, 0);

  return maxRank + 1;
}

/**
 * Swap a pinned tool one position up or down among pinned tools.
 * @param {Tool[]} tools
 * @param {string} id - Tool ID to move
 * @param {"up"|"down"} direction
 * @returns {Tool[]}
 */
export function movePinnedTool(tools, id, direction) {
  const normalized = normalizePinRanks(tools);
  const pinned = sortTools(normalized).filter((tool) => tool.pinned);
  const index = pinned.findIndex((tool) => tool.id === id);
  if (index < 0) return normalized;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= pinned.length) return normalized;

  const reordered = [...pinned];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

  const rankMap = new Map(reordered.map((tool, order) => [tool.id, order + 1]));

  return normalized.map((tool) => ({
    ...tool,
    pinRank: tool.pinned ? rankMap.get(tool.id) ?? tool.pinRank : null,
  }));
}

/**
 * Check whether a value is a launchable URL or path (http, file, UNC, drive, custom scheme, bare domain).
 * @param {*} value
 * @returns {boolean}
 */
export function isValidLaunchTarget(value) {
  const candidate = collapseWhitespace(value);
  if (!candidate) return false;

  if (/^https?:\/\/\S+$/i.test(candidate)) return true;
  if (/^file:\/\/\S+$/i.test(candidate)) return true;
  if (/^\\\\[^\\]+\\[^\\]+/.test(candidate)) return true;
  if (/^[a-zA-Z]:\\/.test(candidate)) return true;
  if (/^[a-zA-Z][a-zA-Z+.-]*:[^\s]+$/.test(candidate)) return true;
  if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/.*)?$/i.test(candidate)) return true;

  return false;
}

/**
 * Normalise a user-entered URL/path into a launchable URL string.
 * @param {*} value
 * @returns {string}
 */
export function normalizeUrl(value) {
  const candidate = collapseWhitespace(value);

  if (/^https?:\/\//i.test(candidate) || /^file:\/\//i.test(candidate)) return candidate;
  if (candidate.startsWith("\\\\")) return `file:${candidate.replace(/\\/g, "/")}`;
  if (/^[a-zA-Z]:\\/.test(candidate)) return `file:///${candidate.replace(/\\/g, "/")}`;
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(candidate)) return candidate;
  return `https://${candidate}`;
}

/**
 * Build a Map from tool signature to tool object for use as hydration fallback.
 * @param {Tool[]} tools
 * @returns {Map<string, Tool>}
 */
export function createFallbackMetadataMap(tools) {
  return new Map(tools.map((tool) => [getToolSignature(tool), tool]));
}

/**
 * Validate, deduplicate and sort a raw launch history array.
 * @param {*} value
 * @returns {HistoryEntry[]}
 */
export function sanitizeLaunchHistory(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const toolId = typeof entry.toolId === "string" ? entry.toolId.trim() : "";
      const launchedAt = typeof entry.launchedAt === "string" ? entry.launchedAt : "";
      const count = Number(entry.count);

      if (!toolId || Number.isNaN(Date.parse(launchedAt)) || !Number.isFinite(count) || count < 1) {
        return null;
      }

      return {
        toolId,
        launchedAt,
        count: Math.max(1, Math.round(count)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.launchedAt) - Date.parse(a.launchedAt));
}

/**
 * Record a tool launch, updating or inserting a history entry and capping at 12.
 * @param {HistoryEntry[]} history
 * @param {string} toolId
 * @returns {HistoryEntry[]}
 */
export function recordLaunch(history, toolId) {
  const now = new Date().toISOString();
  const existing = history.find((entry) => entry.toolId === toolId);

  const nextHistory = existing
    ? history.map((entry) =>
        entry.toolId === toolId
          ? { ...entry, launchedAt: now, count: entry.count + 1 }
          : entry
      )
    : [{ toolId, launchedAt: now, count: 1 }, ...history];

  return sanitizeLaunchHistory(nextHistory).slice(0, 12);
}

/**
 * Remove history entries whose toolId no longer appears in the tools array.
 * @param {HistoryEntry[]} history
 * @param {Tool[]} tools
 * @returns {HistoryEntry[]}
 */
export function filterHistoryForTools(history, tools) {
  const validIds = new Set(tools.map((tool) => tool.id));
  return sanitizeLaunchHistory(history).filter((entry) => validIds.has(entry.toolId));
}

/**
 * Format an ISO timestamp as a short locale-aware date/time string.
 * @param {string} isoValue - ISO 8601 timestamp
 * @returns {string}
 */
export function formatLaunchTime(isoValue) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoValue));
}
