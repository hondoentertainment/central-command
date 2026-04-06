import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "agents",
  gridSelector: "#agentsGrid",
  category: "Agents",
  emptyStateMessage:
    "Add tools with category Agents (e.g. Dreamer, Manus, GetViktor, OpenClaw) to see them here.",
  emptyStateHint: 'Try the <a href="packs.html">AI Builder starter pack</a> for agent tools, or <a href="registry.html">add a tool</a> manually.',
});
