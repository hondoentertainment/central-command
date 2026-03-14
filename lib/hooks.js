/**
 * Launch hooks: fire a webhook when a tool is launched.
 * When central-command.launch-hook-url is set in localStorage, we POST
 * { toolId, toolName, url, timestamp } to that URL on each launch.
 * Fire-and-forget; does not block the launch.
 */

const LAUNCH_HOOK_KEY = "central-command.launch-hook-url";

export function loadLaunchHookUrl() {
  try {
    const v = localStorage.getItem(LAUNCH_HOOK_KEY);
    return typeof v === "string" && v.trim() ? v.trim() : "";
  } catch {
    return "";
  }
}

export function saveLaunchHookUrl(url) {
  try {
    const trimmed = typeof url === "string" ? url.trim() : "";
    if (trimmed) {
      localStorage.setItem(LAUNCH_HOOK_KEY, trimmed);
    } else {
      localStorage.removeItem(LAUNCH_HOOK_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fire the launch hook. Call after opening the tool URL.
 * Fire-and-forget: does not block or await.
 * @param {Object} payload
 * @param {string} payload.toolId
 * @param {string} payload.toolName
 * @param {string} payload.url
 */
export function fireLaunchHook(payload) {
  const url = loadLaunchHookUrl();
  if (!url) return;

  const body = JSON.stringify({
    toolId: payload?.toolId ?? "",
    toolName: payload?.toolName ?? "",
    url: payload?.url ?? "",
    timestamp: new Date().toISOString(),
  });

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {
    // Fire-and-forget: ignore errors
  });
}
