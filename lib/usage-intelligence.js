/**
 * Usage Intelligence - surfaces smart suggestions based on tool launch patterns.
 *
 * Provides time-of-day suggestions, stale tool detection, and weekly digest analytics.
 */

const TIME_BLOCKS = [
  { name: "Night", start: 0, end: 5 },
  { name: "Morning", start: 6, end: 11 },
  { name: "Afternoon", start: 12, end: 17 },
  { name: "Evening", start: 18, end: 23 },
];

/**
 * Returns the time block label for a given hour (0-23).
 * @param {number} hour
 * @returns {string}
 */
export function getTimeBlockLabel(hour) {
  const block = TIME_BLOCKS.find((b) => hour >= b.start && hour <= b.end);
  return block ? block.name : "Morning";
}

/**
 * Checks whether a given ISO timestamp's hour falls in the specified time block.
 * @param {string} isoString
 * @param {{ start: number, end: number }} block
 * @returns {boolean}
 */
function isInTimeBlock(isoString, block) {
  const hour = new Date(isoString).getHours();
  return hour >= block.start && hour <= block.end;
}

/**
 * Suggests tools based on launch frequency in the current time-of-day block.
 * Falls back to overall most-used when there are fewer than 5 launches in the current block.
 *
 * @param {Array} tools - Tool objects (must have .id)
 * @param {Array} history - Launch history entries ({ toolId, launchedAt, count })
 * @param {number} currentHour - 0-23
 * @returns {{ label: string, tools: Array }}
 */
export function getSuggestedTools(tools, history, currentHour) {
  const block = TIME_BLOCKS.find((b) => currentHour >= b.start && currentHour <= b.end) ?? TIME_BLOCKS[1];
  const label = block.name;
  const toolMap = new Map(tools.map((t) => [t.id, t]));

  // Count launches in the current time block per tool
  const blockCounts = new Map();
  let blockTotal = 0;

  for (const entry of history) {
    if (!entry.launchedAt || !toolMap.has(entry.toolId)) continue;
    if (isInTimeBlock(entry.launchedAt, block)) {
      blockCounts.set(entry.toolId, (blockCounts.get(entry.toolId) || 0) + (entry.count || 1));
      blockTotal += entry.count || 1;
    }
  }

  let ranked;

  if (blockTotal >= 5) {
    // Enough data for time-block suggestions
    ranked = [...blockCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => toolMap.get(id))
      .filter(Boolean);
  } else {
    // Fall back to overall most-used
    const overallCounts = new Map();
    for (const entry of history) {
      if (!toolMap.has(entry.toolId)) continue;
      overallCounts.set(entry.toolId, (overallCounts.get(entry.toolId) || 0) + (entry.count || 1));
    }
    ranked = [...overallCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => toolMap.get(id))
      .filter(Boolean);
  }

  return { label, tools: ranked };
}

/**
 * Finds tools that have not been launched in the last N days.
 * Excludes pinned tools (user explicitly wants them around).
 *
 * @param {Array} tools - Tool objects (must have .id, .pinned)
 * @param {Array} history - Launch history entries ({ toolId, launchedAt })
 * @param {number} [thresholdDays=30] - How many days of inactivity before a tool is considered stale
 * @returns {Array<{ tool: Object, lastLaunch: string|null }>}
 */
export function getStaleTools(tools, history, thresholdDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);
  const cutoffIso = cutoff.toISOString();

  // Build a map of toolId -> most recent launchedAt
  const lastLaunchMap = new Map();
  for (const entry of history) {
    const existing = lastLaunchMap.get(entry.toolId);
    if (!existing || entry.launchedAt > existing) {
      lastLaunchMap.set(entry.toolId, entry.launchedAt);
    }
  }

  const stale = [];

  for (const tool of tools) {
    if (tool.pinned) continue; // skip pinned tools
    const lastLaunch = lastLaunchMap.get(tool.id) ?? null;
    if (!lastLaunch || lastLaunch < cutoffIso) {
      stale.push({ tool, lastLaunch });
    }
  }

  // Sort oldest first (never-launched at the end, then by date ascending)
  stale.sort((a, b) => {
    if (!a.lastLaunch && !b.lastLaunch) return 0;
    if (!a.lastLaunch) return 1;
    if (!b.lastLaunch) return -1;
    return a.lastLaunch < b.lastLaunch ? -1 : 1;
  });

  return stale;
}

/**
 * Generates a weekly usage digest.
 *
 * @param {Array} tools - Tool objects (must have .id, .category)
 * @param {Array} history - Launch history entries ({ toolId, launchedAt, count })
 * @returns {{ topTools: Array, totalLaunches: number, streak: number, newTools: Array, categoryBreakdown: Array }}
 */
export function getWeeklyDigest(tools, history) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString();

  const toolMap = new Map(tools.map((t) => [t.id, t]));

  // Launches this week
  const weekCounts = new Map();
  let totalLaunches = 0;

  for (const entry of history) {
    if (!entry.launchedAt || entry.launchedAt < weekAgoIso) continue;
    if (!toolMap.has(entry.toolId)) continue;
    const count = entry.count || 1;
    weekCounts.set(entry.toolId, (weekCounts.get(entry.toolId) || 0) + count);
    totalLaunches += count;
  }

  // Top 5 tools this week
  const topTools = [...weekCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ tool: toolMap.get(id), count }))
    .filter((entry) => entry.tool);

  // Consecutive-day streak (how many days in a row have at least one launch, going back from today)
  const streak = computeStreak(history);

  // Tools added this week (using updatedAt or id-based heuristic)
  const newTools = tools.filter((t) => {
    if (t.updatedAt && t.updatedAt >= weekAgoIso) return true;
    return false;
  });

  // Category breakdown
  const categoryCounts = new Map();
  for (const [toolId, count] of weekCounts) {
    const tool = toolMap.get(toolId);
    if (!tool) continue;
    const cat = tool.category || "Uncategorized";
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + count);
  }

  const categoryBreakdown = [...categoryCounts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalLaunches > 0 ? Math.round((count / totalLaunches) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { topTools, totalLaunches, streak, newTools, categoryBreakdown };
}

/**
 * Computes the consecutive-day launch streak ending today.
 * @param {Array} history
 * @returns {number}
 */
function computeStreak(history) {
  if (!history.length) return 0;

  // Build a Set of date strings (YYYY-MM-DD) that have launches
  const launchDates = new Set();
  for (const entry of history) {
    if (!entry.launchedAt) continue;
    launchDates.add(entry.launchedAt.slice(0, 10));
  }

  const today = new Date();
  let streak = 0;
  const check = new Date(today);

  while (true) {
    const dateStr = check.toISOString().slice(0, 10);
    if (launchDates.has(dateStr)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Checks whether the weekly digest should be shown.
 * Shows on Mondays or on the first visit of the week.
 * @returns {boolean}
 */
export function shouldShowDigest() {
  const now = new Date();
  const lastShown = localStorage.getItem("central-command.lastDigestShown");

  if (!lastShown) return true;

  const lastDate = new Date(lastShown);
  if (isNaN(lastDate.getTime())) return true;

  // Check if we are in a new ISO week (Monday-based)
  const getWeekNumber = (d) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  };

  const nowWeek = getWeekNumber(now);
  const lastWeek = getWeekNumber(lastDate);
  const nowYear = now.getFullYear();
  const lastYear = lastDate.getFullYear();

  return nowYear > lastYear || nowWeek > lastWeek;
}

/**
 * Marks the digest as shown today.
 */
export function markDigestShown() {
  localStorage.setItem("central-command.lastDigestShown", new Date().toISOString().slice(0, 10));
}

/**
 * Checks whether the stale tool nudge should be shown this session.
 * Avoids re-showing within the same day.
 * @returns {boolean}
 */
export function shouldShowStaleNudge() {
  const last = localStorage.getItem("central-command.lastStaleCheck");
  if (!last) return true;
  const today = new Date().toISOString().slice(0, 10);
  return last !== today;
}

/**
 * Marks the stale nudge as shown today.
 */
export function markStaleNudgeShown() {
  localStorage.setItem("central-command.lastStaleCheck", new Date().toISOString().slice(0, 10));
}
