/**
 * Plugin/Extension API for Central Command.
 *
 * Provides plugin registration, lifecycle management, an event bus,
 * namespaced storage, and hooks into tool operations.
 *
 * Usage:
 *   CentralCommand.registerPlugin({ id: 'my-plugin', name: 'My Plugin', ... });
 *   CentralCommand.on('tool:launch', (tool) => { ... });
 */

import { getTheme, setTheme } from "./theme.js";
import { loadStoredTools, STORAGE_KEYS } from "./storage.js";
import { hydrateTools, createFallbackMetadataMap, sortTools, normalizeUrl } from "./tool-model.js";
import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "../data/presets.js";

const VERSION = "1.0.0";

// --- Internal state ---

/** @type {Map<string, PluginDef>} */
const _plugins = new Map();

/** @type {Map<string, Function[]>} */
const _listeners = new Map();

const VALID_EVENTS = [
  "tool:launch",
  "tool:add",
  "tool:remove",
  "tool:update",
  "theme:change",
  "sync:complete",
];

// --- Event bus ---

/**
 * Subscribe to an event.
 * @param {string} event - Event name (e.g. 'tool:launch')
 * @param {Function} handler - Callback function
 */
function on(event, handler) {
  if (typeof handler !== "function") return;
  if (!_listeners.has(event)) _listeners.set(event, []);
  _listeners.get(event).push(handler);
}

/**
 * Unsubscribe from an event.
 * @param {string} event - Event name
 * @param {Function} handler - The same function reference passed to on()
 */
function off(event, handler) {
  const handlers = _listeners.get(event);
  if (!handlers) return;
  const index = handlers.indexOf(handler);
  if (index >= 0) handlers.splice(index, 1);
}

/**
 * Emit an event to all registered listeners and plugin hooks.
 * @param {string} event - Event name
 * @param {*} data - Event payload
 */
function emit(event, data) {
  // Call global listeners
  const handlers = _listeners.get(event);
  if (handlers) {
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.warn(`[CentralCommand] Event handler error for '${event}':`, err);
      }
    }
  }

  // Call plugin hooks for matching events
  const hookMap = {
    "tool:launch": "onToolLaunch",
    "tool:add": "onToolAdd",
    "tool:remove": "onToolRemove",
  };

  const hookName = hookMap[event];
  if (hookName) {
    for (const plugin of _plugins.values()) {
      if (typeof plugin[hookName] === "function") {
        try {
          plugin[hookName](data);
        } catch (err) {
          console.warn(`[CentralCommand] Plugin '${plugin.id}' hook '${hookName}' error:`, err);
        }
      }
    }
  }
}

// --- Plugin storage ---

/**
 * Returns a namespaced localStorage wrapper for the given plugin.
 * @param {string} pluginId - Plugin identifier
 * @returns {{ get(key: string): any, set(key: string, value: any): void, remove(key: string): void, clear(): void }}
 */
function getStorage(pluginId) {
  const prefix = `central-command.plugin.${pluginId}.`;
  return {
    get(key) {
      try {
        const raw = localStorage.getItem(prefix + key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
      } catch (err) {
        console.warn(`[CentralCommand] Plugin storage set failed for '${pluginId}':`, err);
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(prefix + key);
      } catch {}
    },
    clear() {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) keysToRemove.push(k);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
    },
  };
}

// --- Plugin registration and lifecycle ---

/**
 * Register a plugin with Central Command.
 * @param {Object} pluginDef - Plugin definition
 * @param {string} pluginDef.id - Unique plugin identifier
 * @param {string} pluginDef.name - Human-readable name
 * @param {string} [pluginDef.version] - Plugin version
 * @param {Function} [pluginDef.init] - Called when plugin is registered
 * @param {Function} [pluginDef.destroy] - Called when plugin is unregistered
 * @param {Function} [pluginDef.onToolLaunch] - Called before a tool is launched
 * @param {Function} [pluginDef.onToolAdd] - Called after a tool is added
 * @param {Function} [pluginDef.onToolRemove] - Called after a tool is removed
 * @param {Array} [pluginDef.commands] - Custom command palette commands
 * @param {Function} [pluginDef.renderCard] - Custom card renderer
 * @returns {boolean} True if registration succeeded
 */
function registerPlugin(pluginDef) {
  if (!pluginDef || typeof pluginDef !== "object") {
    console.warn("[CentralCommand] registerPlugin: invalid plugin definition");
    return false;
  }

  if (!pluginDef.id || typeof pluginDef.id !== "string") {
    console.warn("[CentralCommand] registerPlugin: plugin must have a string 'id'");
    return false;
  }

  if (_plugins.has(pluginDef.id)) {
    console.warn(`[CentralCommand] registerPlugin: plugin '${pluginDef.id}' is already registered`);
    return false;
  }

  _plugins.set(pluginDef.id, pluginDef);

  // Call init lifecycle hook
  if (typeof pluginDef.init === "function") {
    try {
      pluginDef.init();
    } catch (err) {
      console.warn(`[CentralCommand] Plugin '${pluginDef.id}' init error:`, err);
    }
  }

  console.log(`[CentralCommand] Plugin registered: ${pluginDef.name || pluginDef.id} v${pluginDef.version || "?"}`);
  return true;
}

/**
 * Unregister a plugin. Calls its destroy() lifecycle hook.
 * @param {string} pluginId - Plugin identifier
 * @returns {boolean} True if the plugin was found and unregistered
 */
function unregisterPlugin(pluginId) {
  const plugin = _plugins.get(pluginId);
  if (!plugin) return false;

  if (typeof plugin.destroy === "function") {
    try {
      plugin.destroy();
    } catch (err) {
      console.warn(`[CentralCommand] Plugin '${pluginId}' destroy error:`, err);
    }
  }

  _plugins.delete(pluginId);
  return true;
}

/**
 * List all registered plugins.
 * @returns {Array<{id: string, name: string, version: string}>}
 */
function listPlugins() {
  return Array.from(_plugins.values()).map((p) => ({
    id: p.id,
    name: p.name || p.id,
    version: p.version || "unknown",
  }));
}

// --- Plugin commands for command palette ---

/**
 * Get all commands registered by all plugins.
 * @returns {Array<{name: string, action: Function, pluginId: string}>}
 */
function getPluginCommands() {
  const commands = [];
  for (const plugin of _plugins.values()) {
    if (Array.isArray(plugin.commands)) {
      for (const cmd of plugin.commands) {
        if (cmd && typeof cmd.name === "string" && typeof cmd.action === "function") {
          commands.push({
            name: cmd.name,
            action: cmd.action,
            pluginId: plugin.id,
          });
        }
      }
    }
  }
  return commands;
}

/**
 * Run all plugin renderCard hooks. Returns modified HTML or null if no plugin modified it.
 * @param {Object} tool - Tool object
 * @param {string} defaultHtml - Default card HTML
 * @returns {string|null} Modified HTML or null for default
 */
function runRenderCardHooks(tool, defaultHtml) {
  for (const plugin of _plugins.values()) {
    if (typeof plugin.renderCard === "function") {
      try {
        const result = plugin.renderCard(tool, defaultHtml);
        if (typeof result === "string") return result;
      } catch (err) {
        console.warn(`[CentralCommand] Plugin '${plugin.id}' renderCard error:`, err);
      }
    }
  }
  return null;
}

// --- Tools API ---

const fallbackMetadata = createFallbackMetadataMap(ALL_PRESET_TOOLS);

function toolsGetAll() {
  const tools = loadStoredTools(
    (value) => hydrateTools(value, fallbackMetadata),
    DEFAULT_TOOLS
  );
  return sortTools(tools);
}

function toolsGetById(id) {
  return toolsGetAll().find((t) => t.id === id) || null;
}

function toolsLaunch(id) {
  const tool = toolsGetById(id);
  if (!tool) return false;
  emit("tool:launch", tool);
  const url = normalizeUrl(tool.url);
  if (tool.openMode === "same-tab") {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noreferrer");
  }
  return true;
}

// --- Theme API ---

function themeGet() {
  return getTheme();
}

function themeSet(theme) {
  const previous = getTheme();
  setTheme(theme);
  if (previous !== theme) {
    emit("theme:change", { from: previous, to: theme });
  }
}

// --- Public API ---

/**
 * Initialize the plugin system and expose window.CentralCommand.
 */
export function initPluginSystem() {
  const api = {
    registerPlugin,
    unregisterPlugin,
    on,
    off,
    emit,
    plugins: {
      getStorage,
      list: listPlugins,
      getCommands: getPluginCommands,
    },
    tools: {
      getAll: toolsGetAll,
      getById: toolsGetById,
      launch: toolsLaunch,
    },
    theme: {
      get: themeGet,
      set: themeSet,
    },
    version: VERSION,
  };

  window.CentralCommand = api;
  return api;
}

// Exported for use by other modules
export { emit, getPluginCommands, runRenderCardHooks };
