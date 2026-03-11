import { ICON_OPTIONS } from "./icons.js";

export const SURFACES = ["hero", "spotlight"];
export const ACCENTS = ["amber", "teal", "crimson", "cobalt"];
export const OPEN_MODES = ["new-tab", "same-tab"];

const ICON_KEYS = new Set(ICON_OPTIONS.map((option) => option.value));

export function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function sanitizeSurfaces(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((surface) => SURFACES.includes(surface)))];
}

export function getToolSignature(tool) {
  const name = collapseWhitespace(tool?.name).toLowerCase();
  const url = collapseWhitespace(tool?.url).toLowerCase();
  return `${name}|${url}`;
}

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

export function getNextPinRank(tools) {
  const maxRank = tools.reduce((highest, tool) => {
    if (!tool.pinned || !Number.isFinite(tool.pinRank)) return highest;
    return Math.max(highest, tool.pinRank);
  }, 0);

  return maxRank + 1;
}

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

export function normalizeUrl(value) {
  const candidate = collapseWhitespace(value);

  if (/^https?:\/\//i.test(candidate) || /^file:\/\//i.test(candidate)) return candidate;
  if (candidate.startsWith("\\\\")) return `file:${candidate.replace(/\\/g, "/")}`;
  if (/^[a-zA-Z]:\\/.test(candidate)) return `file:///${candidate.replace(/\\/g, "/")}`;
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(candidate)) return candidate;
  return `https://${candidate}`;
}

export function createFallbackMetadataMap(tools) {
  return new Map(tools.map((tool) => [getToolSignature(tool), tool]));
}

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

export function filterHistoryForTools(history, tools) {
  const validIds = new Set(tools.map((tool) => tool.id));
  return sanitizeLaunchHistory(history).filter((entry) => validIds.has(entry.toolId));
}

export function formatLaunchTime(isoValue) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoValue));
}
