/**
 * Renders the main page navigation. Call with current page key to mark active.
 * On mobile (≤920px), wraps nav in a hamburger menu with slide-down drawer.
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

  setupMobileNav(container);
}

/**
 * Wraps nav in hamburger structure for mobile. Hamburger button toggles drawer.
 * @param {HTMLElement} nav
 */
function setupMobileNav(nav) {
  if (nav.closest(".page-nav-bar")) return;

  const bar = document.createElement("div");
  bar.className = "page-nav-bar";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "page-nav__menu-btn";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", nav.id || "pageNav");
  btn.setAttribute("aria-label", "Toggle navigation menu");
  btn.innerHTML = `<span class="page-nav__menu-icon" aria-hidden="true"><span></span><span></span><span></span></span>`;

  nav.parentNode.insertBefore(bar, nav);
  bar.appendChild(btn);
  bar.appendChild(nav);

  function setOpen(open) {
    bar.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(!!open));
  }

  btn.addEventListener("click", () => setOpen(!bar.classList.contains("is-open")));

  nav.querySelectorAll(".page-nav__link").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && bar.classList.contains("is-open")) setOpen(false);
  });
}
