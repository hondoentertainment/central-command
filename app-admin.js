import { initCategoryHubPage } from "./lib/category-hub-page.js";

initCategoryHubPage({
  navKey: "admin",
  gridSelector: "#adminGrid",
  category: "Admin",
  emptyStateMessage:
    "Add tools with category Admin (e.g. GitHub, Vercel, CI dashboards) to see them here.",
});
