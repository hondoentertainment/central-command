import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "productivity",
  gridSelector: "#productivityGrid",
  category: "Productivity",
  emptyStateMessage: "Add tools with category Productivity (e.g. Evernote, task managers) to see them here.",
});
