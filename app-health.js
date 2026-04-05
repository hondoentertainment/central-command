import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "health",
  gridSelector: "#healthGrid",
  category: "Health",
  emptyStateMessage:
    "Add tools with category Health (e.g. Apple Fitness, Pedometer++, Nourish, Fitbod) to see them here.",
});
