import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "productivity",
  gridSelector: "#productivityGrid",
  category: "Productivity",
  emptyStateMessage: "Add tools with category Productivity (e.g. Evernote, task managers) to see them here.",
  emptyStateHint: 'Try the <a href="packs.html">Full Command starter pack</a> for Notion, Evernote, and more, or <a href="registry.html">add a tool</a> manually.',
});
