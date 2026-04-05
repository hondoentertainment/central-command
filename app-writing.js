import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "writing",
  gridSelector: "#writingGrid",
  category: "Writing",
  emptyStateMessage: "Add tools with category Writing (e.g. Google Docs, Grammarly) to see them here.",
});
