/**
 * Example Plugin for Central Command
 *
 * Demonstrates the plugin API by:
 * - Logging tool launches to the console
 * - Adding a custom "Hello World" command to the command palette
 * - Using namespaced plugin storage
 *
 * To use this plugin, add it to your page:
 *   <script type="module" src="./plugins/example-plugin.js"></script>
 *
 * Or register it programmatically after CentralCommand is initialized:
 *   CentralCommand.registerPlugin({ ... });
 */

(function () {
  // Wait for the CentralCommand API to be available
  function waitForApi(callback, maxAttempts) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.CentralCommand) {
        clearInterval(interval);
        callback();
      } else if (attempts >= (maxAttempts || 50)) {
        clearInterval(interval);
        console.warn("[ExamplePlugin] CentralCommand API not found after waiting.");
      }
    }, 100);
  }

  waitForApi(() => {
    CentralCommand.registerPlugin({
      id: "example-plugin",
      name: "Example Plugin",
      version: "1.0.0",

      /**
       * Called when the plugin is registered.
       * Use this to set up any initial state.
       */
      init() {
        console.log("[ExamplePlugin] Initialized!");

        // Use namespaced plugin storage
        const storage = CentralCommand.plugins.getStorage("example-plugin");
        const launchCount = storage.get("totalLaunches") || 0;
        console.log(`[ExamplePlugin] Total recorded launches so far: ${launchCount}`);

        // Subscribe to events via the event bus
        CentralCommand.on("tool:launch", this._handleLaunch);
        CentralCommand.on("theme:change", this._handleThemeChange);
      },

      /**
       * Called when the plugin is unregistered.
       * Clean up event listeners here.
       */
      destroy() {
        console.log("[ExamplePlugin] Destroyed. Cleaning up.");
        CentralCommand.off("tool:launch", this._handleLaunch);
        CentralCommand.off("theme:change", this._handleThemeChange);
      },

      /**
       * Hook: called before a tool is launched.
       * @param {Object} tool - The tool being launched
       */
      onToolLaunch(tool) {
        console.log(`[ExamplePlugin] Tool launched: ${tool.name} (${tool.url})`);

        // Track launch count in plugin storage
        const storage = CentralCommand.plugins.getStorage("example-plugin");
        const count = (storage.get("totalLaunches") || 0) + 1;
        storage.set("totalLaunches", count);
      },

      /**
       * Hook: called after a tool is added.
       * @param {Object} tool - The newly added tool
       */
      onToolAdd(tool) {
        console.log(`[ExamplePlugin] New tool added: ${tool.name}`);
      },

      /**
       * Hook: called after a tool is removed.
       * @param {Object} tool - The removed tool
       */
      onToolRemove(tool) {
        console.log(`[ExamplePlugin] Tool removed: ${tool.name}`);
      },

      /**
       * Custom commands for the command palette.
       * These appear alongside the built-in commands when searching.
       */
      commands: [
        {
          name: "Hello World",
          action() {
            alert(
              "Hello from the Example Plugin!\n\n" +
              `Central Command v${CentralCommand.version}\n` +
              `Theme: ${CentralCommand.theme.get()}\n` +
              `Tools: ${CentralCommand.tools.getAll().length}\n` +
              `Plugins: ${CentralCommand.plugins.list().map((p) => p.name).join(", ")}`
            );
          },
        },
        {
          name: "Show Launch Stats",
          action() {
            const storage = CentralCommand.plugins.getStorage("example-plugin");
            const count = storage.get("totalLaunches") || 0;
            alert(`Total tool launches tracked by Example Plugin: ${count}`);
          },
        },
      ],

      // Internal event handlers (stored as properties so they can be removed)
      _handleLaunch(tool) {
        console.log(`[ExamplePlugin] Event bus: tool:launch for "${tool.name}"`);
      },

      _handleThemeChange(data) {
        console.log(`[ExamplePlugin] Theme changed: ${data.from} -> ${data.to}`);
      },
    });
  });
})();
