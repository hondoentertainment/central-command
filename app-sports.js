import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "sports",
  gridSelector: "#sportsGrid",
  category: "Sports",
  emptyStateMessage: "Add tools with category Sports (e.g. ESPN) to see them here.",
});
