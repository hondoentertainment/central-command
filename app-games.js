import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "games",
  gridSelector: "#gamesGrid",
  category: "Games",
  emptyStateMessage: "Add tools with category Games (e.g. HSX) to see them here.",
});
