const STORAGE_KEY = "central-command.workspaces";
const ACTIVE_KEY = "central-command.active-workspace";

const DEFAULT_WORKSPACES = [
  { id: "all", name: "All", icon: "\u{1F310}", toolIds: [], projectIds: [], isDefault: true },
  { id: "deep-work", name: "Deep Work", icon: "\u{1F3AF}", toolIds: [], projectIds: [] },
  { id: "admin", name: "Admin", icon: "\u2699\uFE0F", toolIds: [], projectIds: [] },
  { id: "creative", name: "Creative", icon: "\u{1F3A8}", toolIds: [], projectIds: [] },
];

export function loadWorkspaces() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return structuredClone(DEFAULT_WORKSPACES);
}

export function saveWorkspaces(workspaces) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
}

export function getActiveWorkspaceId() {
  return localStorage.getItem(ACTIVE_KEY) || "all";
}

export function setActiveWorkspaceId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveWorkspace(workspaces) {
  const activeId = getActiveWorkspaceId();
  return workspaces.find((ws) => ws.id === activeId) || workspaces[0];
}

export function createWorkspace({ name, icon, toolIds = [], projectIds = [] }) {
  const workspaces = loadWorkspaces();
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || `ws-${Date.now()}`;

  const workspace = { id, name, icon, toolIds, projectIds };
  workspaces.push(workspace);
  saveWorkspaces(workspaces);
  return workspace;
}

export function updateWorkspace(workspaces, id, updates) {
  return workspaces.map((ws) => {
    if (ws.id !== id) return ws;
    return { ...ws, ...updates, id: ws.id, isDefault: ws.isDefault };
  });
}

export function deleteWorkspace(workspaces, id) {
  if (id === "all") return workspaces;
  const filtered = workspaces.filter((ws) => ws.id !== id);
  if (getActiveWorkspaceId() === id) {
    setActiveWorkspaceId("all");
  }
  return filtered;
}

export function filterToolsByWorkspace(tools, workspace) {
  if (!workspace || workspace.isDefault || !workspace.toolIds || workspace.toolIds.length === 0) {
    return tools;
  }
  const allowed = new Set(workspace.toolIds);
  return tools.filter((tool) => allowed.has(tool.id) || allowed.has(tool.name));
}

export function filterProjectsByWorkspace(projects, workspace) {
  if (!workspace || workspace.isDefault || !workspace.projectIds || workspace.projectIds.length === 0) {
    return projects;
  }
  const allowed = new Set(workspace.projectIds);
  return projects.filter((project) => allowed.has(project.id) || allowed.has(project.name));
}
