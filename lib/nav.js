/**
 * Renders the main page navigation. Call with current page key to mark active.
 * @param {string} current - One of: "command" | "registry" | "packs" | "history" | "runbook"
 */
export function renderNav(current) {
  const container = document.querySelector("#pageNav");
  if (!container) return;

  const links = [
    { key: "command", href: "index.html", label: "Command" },
    { key: "registry", href: "registry.html", label: "Tool Registry" },
    { key: "packs", href: "packs.html", label: "Starter Packs" },
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
