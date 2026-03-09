export const STORAGE_KEYS = {
  tools: "central-command.tools.v2",
  legacyTools: ["central-command.tools.v1"],
  notes: "central-command.notes.v1",
  launchHistory: "central-command.launch-history.v1",
};

function loadJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadStoredToolPayload() {
  const current = loadJson(STORAGE_KEYS.tools);
  if (current) return current;

  for (const legacyKey of STORAGE_KEYS.legacyTools) {
    const legacy = loadJson(legacyKey);
    if (legacy) return legacy;
  }

  return null;
}

export function hasSavedTools() {
  if (localStorage.getItem(STORAGE_KEYS.tools) !== null) return true;
  return STORAGE_KEYS.legacyTools.some((legacyKey) => localStorage.getItem(legacyKey) !== null);
}

export function loadStoredTools(hydrateTools, fallbackTools) {
  const stored = loadStoredToolPayload();
  if (!stored) return structuredClone(fallbackTools);

  const hydrated = hydrateTools(stored);
  return hydrated.length > 0 ? hydrated : structuredClone(fallbackTools);
}

export function saveStoredTools(tools) {
  localStorage.setItem(STORAGE_KEYS.tools, JSON.stringify(tools));
}

export function loadNotes() {
  return localStorage.getItem(STORAGE_KEYS.notes) ?? "";
}

export function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEYS.notes, notes);
}

export function loadLaunchHistory(sanitizeLaunchHistory) {
  return sanitizeLaunchHistory(loadJson(STORAGE_KEYS.launchHistory));
}

export function saveLaunchHistory(history) {
  localStorage.setItem(STORAGE_KEYS.launchHistory, JSON.stringify(history));
}
