import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "./data/presets.js";
import { renderNav } from "./lib/nav.js";
import { createFallbackMetadataMap, hydrateTools, sanitizeLaunchHistory } from "./lib/tool-model.js";
import { loadStoredTools, loadLaunchHistory, loadNotesMeta, loadSecurityEvents } from "./lib/storage.js";
import { initFirebase, isFirebaseConfigured, onAuthStateChanged } from "./lib/firebase.js";
import { getAccountTier } from "./lib/auth-policy.js";

const fallbackMetadata = createFallbackMetadataMap(ALL_PRESET_TOOLS);

const elements = {
  profileSyncStatus: document.querySelector("#profileSyncStatus"),
  profileAccountTier: document.querySelector("#profileAccountTier"),
  profileUserId: document.querySelector("#profileUserId"),
  profileLastSignIn: document.querySelector("#profileLastSignIn"),
  profileToolCount: document.querySelector("#profileToolCount"),
  profilePinnedCount: document.querySelector("#profilePinnedCount"),
  profileLaunchCount: document.querySelector("#profileLaunchCount"),
  profileNotesEdited: document.querySelector("#profileNotesEdited"),
  profileSecurityEvents: document.querySelector("#profileSecurityEvents"),
};

initialize();

async function initialize() {
  renderNav("profile");
  renderWorkspaceStats();
  renderSecurityEvents();
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

function renderSecurityEvents() {
  const events = loadSecurityEvents(20);
  const list = elements.profileSecurityEvents;
  if (!list) return;
  list.innerHTML = "";
  if (events.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-list__empty";
    empty.textContent = "No security activity yet.";
    list.appendChild(empty);
    return;
  }

  events.forEach((event) => {
    const item = document.createElement("li");
    item.className = "history-item";
    const left = document.createElement("div");
    left.className = "history-item__link";
    const title = document.createElement("strong");
    title.textContent = event.type.replaceAll("_", " ");
    const time = document.createElement("span");
    time.textContent = formatTimestamp(event.at);
    left.append(title, time);

    const tier = document.createElement("span");
    tier.className = "history-item__count";
    tier.textContent = event.accountTier || "unknown";

    item.append(left, tier);
    list.appendChild(item);
  });
}

async function renderAccountState() {
  await initFirebase();
  if (!isFirebaseConfigured()) {
    elements.profileSyncStatus.textContent = "Not configured";
    elements.profileAccountTier.textContent = "Local only";
    elements.profileUserId.textContent = "Firebase config missing";
    elements.profileLastSignIn.textContent = "-";
    return;
  }

  onAuthStateChanged((user) => {
    if (!user) {
      elements.profileSyncStatus.textContent = "Signed out";
      elements.profileAccountTier.textContent = "Signed out";
      elements.profileUserId.textContent = "-";
      elements.profileLastSignIn.textContent = "-";
      return;
    }
    const tier = getAccountTier(user);
    elements.profileSyncStatus.textContent = tier === "verified" ? "Cloud sync enabled" : "Limited sync";
    elements.profileAccountTier.textContent =
      tier === "guest" ? "Guest" : tier === "unverified" ? "Unverified" : "Verified";
    elements.profileUserId.textContent = user.uid;
    elements.profileLastSignIn.textContent = formatTimestamp(user?.metadata?.lastSignInTime);
  });
}

function formatTimestamp(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}
