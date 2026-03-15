import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "./data/presets.js";
import { renderNav } from "./lib/nav.js";
import { createFallbackMetadataMap, hydrateTools, sanitizeLaunchHistory } from "./lib/tool-model.js";
import { loadStoredTools, loadLaunchHistory, loadNotesMeta } from "./lib/storage.js";
import { initFirebase, isFirebaseConfigured, onAuthStateChanged } from "./lib/firebase.js";

const fallbackMetadata = createFallbackMetadataMap(ALL_PRESET_TOOLS);

const elements = {
  profileSyncStatus: document.querySelector("#profileSyncStatus"),
  profileUserId: document.querySelector("#profileUserId"),
  profileToolCount: document.querySelector("#profileToolCount"),
  profilePinnedCount: document.querySelector("#profilePinnedCount"),
  profileLaunchCount: document.querySelector("#profileLaunchCount"),
  profileNotesEdited: document.querySelector("#profileNotesEdited"),
};

initialize();

async function initialize() {
  renderNav("profile");
  renderWorkspaceStats();
  await renderAccountState();
}

function renderWorkspaceStats() {
  const tools = loadStoredTools(
    (value) => hydrateTools(value, fallbackMetadata),
    DEFAULT_TOOLS
  );
  const history = loadLaunchHistory(sanitizeLaunchHistory);
  const launches = history.reduce((sum, entry) => sum + entry.count, 0);
  const notesMeta = loadNotesMeta();

  elements.profileToolCount.textContent = String(tools.length);
  elements.profilePinnedCount.textContent = String(tools.filter((tool) => tool.pinned).length);
  elements.profileLaunchCount.textContent = String(launches);
  elements.profileNotesEdited.textContent = formatTimestamp(notesMeta?.lastEdited);
}

async function renderAccountState() {
  await initFirebase();
  if (!isFirebaseConfigured()) {
    elements.profileSyncStatus.textContent = "Not configured";
    elements.profileUserId.textContent = "Firebase config missing";
    return;
  }

  onAuthStateChanged((user) => {
    if (!user) {
      elements.profileSyncStatus.textContent = "Signed out";
      elements.profileUserId.textContent = "-";
      return;
    }
    elements.profileSyncStatus.textContent = "Signed in";
    elements.profileUserId.textContent = user.uid;
  });
}

function formatTimestamp(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}
