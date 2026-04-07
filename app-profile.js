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
  renderAnalytics();
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

function renderAnalytics() {
  const grid = document.querySelector("#analyticsGrid");
  if (!grid) return;

  const history = loadLaunchHistory(sanitizeLaunchHistory);
  const tools = loadStoredTools(
    (value) => hydrateTools(value, fallbackMetadata),
    DEFAULT_TOOLS
  );

  let projects = [];
  try {
    const raw = localStorage.getItem("central-command.projects");
    if (raw) projects = JSON.parse(raw);
  } catch { /* empty */ }

  let tasks = [];
  try {
    const raw = localStorage.getItem("central-command.tasks.v1");
    if (raw) tasks = JSON.parse(raw);
  } catch { /* empty */ }

  grid.innerHTML = "";

  // --- Card 1: Tool Usage ---
  const toolUsageCard = document.createElement("div");
  toolUsageCard.className = "analytics-card";
  const sorted = [...history].sort((a, b) => b.count - a.count).slice(0, 5);
  const maxCount = sorted.length > 0 ? sorted[0].count : 1;
  let toolUsageHTML = '<p class="analytics-card__title">Tool Usage</p>';
  if (sorted.length === 0) {
    toolUsageHTML += '<p style="color:var(--muted);font-size:0.85rem;">No launches yet.</p>';
  } else {
    sorted.forEach((entry) => {
      const tool = tools.find((t) => t.id === entry.toolId);
      const name = tool ? tool.name : entry.toolId;
      const pct = (entry.count / maxCount) * 100;
      toolUsageHTML += `
        <div class="analytics-card__bar-row">
          <span class="analytics-card__bar-label" title="${name}">${name}</span>
          <div class="analytics-card__bar-track">
            <div class="analytics-card__bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="analytics-card__bar-count">${entry.count}</span>
        </div>`;
    });
  }
  toolUsageCard.innerHTML = toolUsageHTML;
  grid.appendChild(toolUsageCard);

  // --- Card 2: Category Breakdown ---
  const catCard = document.createElement("div");
  catCard.className = "analytics-card";
  const catCounts = {};
  tools.forEach((t) => {
    const cat = t.category || "Uncategorized";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const topCat = catEntries.length > 0 ? catEntries[0][0] : null;
  let catHTML = '<p class="analytics-card__title">Category Breakdown</p>';
  if (catEntries.length === 0) {
    catHTML += '<p style="color:var(--muted);font-size:0.85rem;">No tools found.</p>';
  } else {
    catEntries.forEach(([cat, count]) => {
      const highlight = cat === topCat ? "font-weight:700;color:var(--teal);" : "";
      catHTML += `
        <div class="analytics-card__status-row">
          <span style="${highlight}">${cat}</span>
          <span class="analytics-card__status-count" style="${highlight}">${count}</span>
        </div>`;
    });
  }
  catCard.innerHTML = catHTML;
  grid.appendChild(catCard);

  // --- Card 3: Project Health ---
  const projCard = document.createElement("div");
  projCard.className = "analytics-card";
  const STATUS_COLORS = {
    idea: "#8f8b82",
    planning: "#5b7fdb",
    "in-progress": "#e8a43a",
    review: "#a78bfa",
    done: "#3eb4a5",
    "on-hold": "#e85a6b",
  };
  const STATUS_LABELS = {
    idea: "Idea",
    planning: "Planning",
    "in-progress": "In Progress",
    review: "Review",
    done: "Done",
    "on-hold": "On Hold",
  };
  const statusCounts = {};
  Object.keys(STATUS_COLORS).forEach((s) => { statusCounts[s] = 0; });
  projects.forEach((p) => {
    const s = p.status || "idea";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  let projHTML = '<p class="analytics-card__title">Project Health</p>';
  Object.entries(statusCounts).forEach(([status, count]) => {
    projHTML += `
      <div class="analytics-card__status-row">
        <span class="analytics-card__status-dot" style="background:${STATUS_COLORS[status] || "#888"}"></span>
        <span>${STATUS_LABELS[status] || status}</span>
        <span class="analytics-card__status-count">${count}</span>
      </div>`;
  });
  const now = Date.now();
  const staleThreshold = 14 * 24 * 60 * 60 * 1000;
  const staleProjects = projects.filter((p) => {
    if (p.status === "done") return false;
    const updated = p.updatedAt || p.createdAt;
    if (!updated) return false;
    return now - new Date(updated).getTime() > staleThreshold;
  });
  if (staleProjects.length > 0) {
    staleProjects.forEach((p) => {
      projHTML += `<div class="analytics-card__alert">Stale: ${p.name || p.title || "Untitled"}</div>`;
    });
  }
  projCard.innerHTML = projHTML;
  grid.appendChild(projCard);

  // --- Card 4: Task Summary ---
  const taskCard = document.createElement("div");
  taskCard.className = "analytics-card";
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done" || t.status === "archived").length;
  const overdueTasks = tasks.filter((t) => {
    if (t.status === "done" || t.status === "archived") return false;
    if (!t.dueDate) return false;
    return new Date(t.dueDate).getTime() < now;
  }).length;
  const inboxTasks = tasks.filter((t) => t.status === "inbox").length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  let taskHTML = '<p class="analytics-card__title">Task Summary</p>';
  taskHTML += `<div class="analytics-card__rate">${completionRate}%</div>`;
  taskHTML += `<p class="analytics-card__streak-label" style="margin-bottom:12px;">completion rate</p>`;
  taskHTML += `
    <div class="analytics-card__status-row">
      <span>Total</span><span class="analytics-card__status-count">${totalTasks}</span>
    </div>
    <div class="analytics-card__status-row">
      <span>Done</span><span class="analytics-card__status-count">${doneTasks}</span>
    </div>
    <div class="analytics-card__status-row">
      <span>Overdue</span><span class="analytics-card__status-count" style="color:var(--crimson)">${overdueTasks}</span>
    </div>
    <div class="analytics-card__status-row">
      <span>Inbox</span><span class="analytics-card__status-count">${inboxTasks}</span>
    </div>`;
  taskCard.innerHTML = taskHTML;
  grid.appendChild(taskCard);

  // --- Card 5: Activity Streak ---
  const streakCard = document.createElement("div");
  streakCard.className = "analytics-card";
  const launchDays = new Set();
  history.forEach((entry) => {
    if (entry.launchedAt) {
      const d = new Date(entry.launchedAt);
      if (!Number.isNaN(d.getTime())) {
        launchDays.add(d.toISOString().slice(0, 10));
      }
    }
  });
  const sortedDays = [...launchDays].sort().reverse();
  let currentStreak = 0;
  let bestStreak = 0;
  if (sortedDays.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    if (sortedDays[0] === todayStr || sortedDays[0] === yesterdayStr) {
      const checkDate = new Date(sortedDays[0]);
      for (const dayStr of sortedDays) {
        const expected = checkDate.toISOString().slice(0, 10);
        if (dayStr === expected) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate best streak
    let tempStreak = 1;
    const ascending = [...sortedDays].reverse();
    for (let i = 1; i < ascending.length; i++) {
      const prev = new Date(ascending[i - 1]);
      const curr = new Date(ascending[i]);
      const diff = (curr - prev) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        tempStreak++;
      } else {
        if (tempStreak > bestStreak) bestStreak = tempStreak;
        tempStreak = 1;
      }
    }
    if (tempStreak > bestStreak) bestStreak = tempStreak;
  }
  let streakHTML = '<p class="analytics-card__title">Activity Streak</p>';
  streakHTML += `<div class="analytics-card__streak">${currentStreak}</div>`;
  streakHTML += `<p class="analytics-card__streak-label">${currentStreak === 1 ? "day streak" : "day streak"}</p>`;
  if (bestStreak > 0) {
    streakHTML += `<p class="analytics-card__streak-label" style="margin-top:8px;">Best: ${bestStreak} day${bestStreak === 1 ? "" : "s"}</p>`;
  }
  streakCard.innerHTML = streakHTML;
  grid.appendChild(streakCard);

  // --- Card 6: Weekly Patterns ---
  const weekCard = document.createElement("div");
  weekCard.className = "analytics-card";
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  history.forEach((entry) => {
    if (entry.launchedAt) {
      const d = new Date(entry.launchedAt);
      if (!Number.isNaN(d.getTime())) {
        dayCounts[d.getDay()] += entry.count || 1;
      }
    }
  });
  // Reorder Mon-Sun
  const orderedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const orderedCounts = [dayCounts[1], dayCounts[2], dayCounts[3], dayCounts[4], dayCounts[5], dayCounts[6], dayCounts[0]];
  const maxDay = Math.max(...orderedCounts, 1);
  let peakDay = orderedDays[0];
  let peakVal = 0;
  orderedCounts.forEach((c, i) => {
    if (c > peakVal) { peakVal = c; peakDay = orderedDays[i]; }
  });
  let weekHTML = '<p class="analytics-card__title">Weekly Patterns</p>';
  if (peakVal > 0) {
    weekHTML += `<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px;">Peak day: <strong style="color:var(--teal)">${peakDay}</strong></p>`;
  }
  orderedDays.forEach((day, i) => {
    const pct = (orderedCounts[i] / maxDay) * 100;
    weekHTML += `
      <div class="analytics-card__bar-row">
        <span class="analytics-card__bar-label" style="width:40px">${day}</span>
        <div class="analytics-card__bar-track">
          <div class="analytics-card__bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="analytics-card__bar-count">${orderedCounts[i]}</span>
      </div>`;
  });
  weekCard.innerHTML = weekHTML;
  grid.appendChild(weekCard);
}
