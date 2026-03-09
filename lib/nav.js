/**
 * Renders the main page navigation. Call with current page key to mark active.
 * @param {string} current - One of: "command" | "registry" | "agents" | "packs" | "sports" | "games" | "writing" | "productivity" | "history" | "runbook"
 */
export function renderNav(current) {
  const container = document.querySelector("#pageNav");
  if (!container) return;

  const links = [
    { key: "command", href: "index.html", label: "Command" },
    { key: "registry", href: "registry.html", label: "Tool Registry" },
    { key: "agents", href: "agents.html", label: "Agents" },
    { key: "packs", href: "packs.html", label: "Starter Packs" },
    { key: "sports", href: "sports.html", label: "Sports Page" },
    { key: "games", href: "games.html", label: "Games Page" },
    { key: "writing", href: "writing.html", label: "Writing" },
    { key: "productivity", href: "productivity.html", label: "Productivity Page" },
    { key: "history", href: "history.html", label: "Recent History" },
    { key: "runbook", href: "runbook.html", label: "Runbook" },
  ];

  container.innerHTML = links
    .map(
      ({ key, href, label }) =>
        `<a class="page-nav__link${key === current ? " is-active" : ""}" href="${href}">${label}</a>`
    )
    .join("");
}
