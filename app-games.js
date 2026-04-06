import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "games",
  gridSelector: "#gamesGrid",
  category: "Games",
  emptyStateMessage: "Add tools with category Games (e.g. HSX) to see them here.",
  emptyStateHint: 'Try the <a href="packs.html">Full Command starter pack</a> for HSX, or <a href="registry.html">add a tool</a> manually.',
});
