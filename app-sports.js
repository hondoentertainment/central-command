import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "sports",
  gridSelector: "#sportsGrid",
  category: "Sports",
  emptyStateMessage: "Add tools with category Sports (e.g. ESPN) to see them here.",
  emptyStateHint: 'Try the <a href="packs.html">Full Command starter pack</a> for ESPN, MLB, NBA, NFL, and more, or <a href="registry.html">add a tool</a> manually.',
});
