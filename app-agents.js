import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "agents",
  gridSelector: "#agentsGrid",
  category: "Agents",
  emptyStateMessage:
    "Add tools with category Agents (e.g. Dreamer, Manus, GetViktor, OpenClaw) to see them here.",
});
