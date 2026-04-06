import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "writing",
  gridSelector: "#writingGrid",
  category: "Writing",
  emptyStateMessage: "Add tools with category Writing (e.g. Google Docs, Grammarly) to see them here.",
  emptyStateHint: 'Try the <a href="packs.html">Creative Hub starter pack</a> for writing tools, or <a href="registry.html">add a tool</a> manually.',
});
