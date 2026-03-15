import { renderAuthUI, getOrCreateAuthSlot } from "./auth-ui.js";
import { initCommandPalette } from "./command-palette.js";
import { initTheme } from "./theme.js";
import { loadIntegrationsPreferences } from "./storage.js";
import { getCreativeHubConfig, openCreativeHub, trackIntegrationEvent } from "./integrations.js";
import { showToast } from "./toast.js";

/** Only init command palette once */
let commandPaletteInitialized = false;

/**
 * Renders the main page navigation. Call with current page key to mark active.
 * On mobile (≤920px), wraps nav in a hamburger menu with slide-down drawer.
 * @param {string} current - One of: "command" | "registry" | "agents" | "packs" | "sports" | "games" | "health" | "admin" | "writing" | "productivity" | "history" | "runbook" | "profile" | "settings"
 * @param {Object} [options]
 * @param {() => void} [options.onAuthChange] - Called when auth state changes (for sync)
 */
export function renderNav(current, options = {}) {
  initTheme();
  if (!commandPaletteInitialized) {
    commandPaletteInitialized = true;
    initCommandPalette();
  }
  const container = document.querySelector("#pageNav");
  if (!container) return;

  const integrationPrefs = loadIntegrationsPreferences();
  const creativeHub = getCreativeHubConfig(integrationPrefs);
  const isSidebarNav = !!container.closest(".dashboard-sidebar");

  const mainLinks = [
    { key: "command", href: "index.html", label: "Command", icon: "🏠" },
    { key: "history", href: "history.html", label: "History", icon: "📈" },
    { key: "registry", href: "registry.html", label: "Tool Registry", icon: "📁" },
    { key: "agents", href: "agents.html", label: "Agents", icon: "👥" },
  ];

  const utilityLinks = [
    { key: "sports", href: "sports.html", label: "Sports", icon: "🏈" },
    { key: "games", href: "games.html", label: "Games", icon: "🎮" },
    { key: "health", href: "health.html", label: "Health", icon: "🩺" },
    { key: "writing", href: "writing.html", label: "Writing", icon: "✍️" },
    { key: "productivity", href: "productivity.html", label: "Productivity", icon: "⚡" },
    { key: "runbook", href: "runbook.html", label: "Runbook", icon: "📘" },
  ];

  if (creativeHub.enabled && creativeHub.showInNav) {
    utilityLinks.push({ key: "creative-hub", href: creativeHub.url, label: "Creative Hub", icon: "🎨", external: true });
  }

  container.classList.remove("page-nav--sidebar", "page-nav--header");
  container.classList.add(isSidebarNav ? "page-nav--sidebar" : "page-nav--header");

  if (isSidebarNav) {
    container.innerHTML = `
      <div class="sidebar-brand">
        <span class="sidebar-brand__logo">⚡</span>
        <div>
          <strong>Central</strong>
          <span>Command</span>
        </div>
      </div>
      <div class="sidebar-section">
        ${mainLinks.map((link) => renderLink(link, current, creativeHub)).join("")}
      </div>
      ${renderProfileSection(current, "sidebar")}
      <div class="sidebar-section sidebar-section--secondary">
        ${utilityLinks.map((link) => renderLink(link, current, creativeHub)).join("")}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="header-nav-links">
        ${mainLinks
          .map(({ key, href, label }) => {
            const active = key === current ? " is-active" : "";
            return `<a class="page-nav__link${active}" href="${href}" data-key="${key}">${label}</a>`;
          })
          .join("")}
      </div>
      ${renderProfileSection(current, "header")}
    `;
  }

  const authSlot = getOrCreateAuthSlot(container);
  if (authSlot) renderAuthUI(authSlot, options);

  const creativeHubLink = container.querySelector('[data-key="creative-hub"]');
  creativeHubLink?.addEventListener("click", (event) => {
    event.preventDefault();
    openCreativeHub(creativeHub, {
      source: current,
      trackEvent: trackIntegrationEvent,
      onError: (message) => showToast(message, "error"),
    });
  });

  if (!isSidebarNav) setupMobileNav(container);
}

function renderLink(link, current, creativeHub) {
  const active = link.key === current ? " is-active" : "";
  const target =
    link.external && creativeHub.openMode !== "same-tab" ? ' target="_blank" rel="noreferrer"' : "";
  return `<a class="page-nav__link sidebar-link${active}" href="${link.href}"${target} data-key="${link.key}"><span class="sidebar-link__icon">${link.icon}</span><span>${link.label}</span></a>`;
}

function renderProfileSection(current, mode = "header") {
  const cls = mode === "sidebar" ? "sidebar-profile" : "header-profile";
  const titleCls = mode === "sidebar" ? "sidebar-profile__title" : "header-profile__title";
  const childrenCls = mode === "sidebar" ? "sidebar-profile__children" : "header-profile__children";
  const childCls = mode === "sidebar" ? "sidebar-profile__child" : "header-profile__child";
  return `
    <div class="${cls}">
      <a class="page-nav__link ${titleCls}${current === "profile" ? " is-active" : ""}" href="profile.html" data-key="profile">👤 Profile</a>
      <div class="${childrenCls}">
        ${[
          { key: "admin", href: "admin.html", label: "Admin" },
          { key: "settings", href: "settings.html", label: "Settings" },
          { key: "packs", href: "packs.html", label: "Starter Pack" },
        ]
          .map(
            (item) =>
              `<a class="page-nav__link ${childCls}${item.key === current ? " is-active" : ""}" href="${item.href}" data-key="${item.key}">${item.label}</a>`
          )
          .join("")}
      </div>
    </div>
  `;
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
