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
 * @param {string} current - One of: "command" | "registry" | "agents" | "packs" | "sports" | "games" | "health" | "music" | "movies" | "parties" | "admin" | "writing" | "productivity" | "history" | "runbook" | "profile" | "settings"
 * @param {Object} [options]
 * @param {() => void} [options.onAuthChange] - Called when auth state changes (for sync)
 * @returns {void}
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

  const primaryLinks = [
    { key: "command", href: "index.html", label: "Home", icon: "🏠" },
    { key: "projects", href: "projects.html", label: "Projects", icon: "📊" },
    { key: "registry", href: "registry.html", label: "Tools", icon: "📁" },
    { key: "history", href: "history.html", label: "History", icon: "📈" },
    { key: "runbook", href: "runbook.html", label: "Runbook", icon: "📘" },
  ];

  const workspaceLinks = [
    { key: "agents", href: "agents.html", label: "Agents", icon: "👥" },
    { key: "packs", href: "packs.html", label: "Starter Packs", icon: "🧰" },
    { key: "productivity", href: "productivity.html", label: "Productivity", icon: "⚡" },
    { key: "writing", href: "writing.html", label: "Writing", icon: "✍️" },
    { key: "sports", href: "sports.html", label: "Sports", icon: "🏈" },
    { key: "games", href: "games.html", label: "Games", icon: "🎮" },
    { key: "health", href: "health.html", label: "Health", icon: "🩺" },
    { key: "music", href: "music.html", label: "Music", icon: "🎵" },
    { key: "movies", href: "movies.html", label: "Movies", icon: "🎬" },
    { key: "parties", href: "parties.html", label: "Parties", icon: "🎉" },
  ];

  if (creativeHub.enabled && creativeHub.showInNav) {
    workspaceLinks.push({
      key: "creative-hub",
      href: creativeHub.url,
      label: "Creative Hub",
      icon: "🎨",
      external: true,
    });
  }

  const profileLinks = [
    { key: "profile", href: "profile.html", label: "Profile" },
    { key: "admin", href: "admin.html", label: "Admin" },
    { key: "settings", href: "settings.html", label: "Settings" },
  ];

  const links = [
    { key: "command", href: "index.html", label: "Command" },
    { key: "projects", href: "projects.html", label: "Projects" },
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

  if (creativeHub.enabled && creativeHub.showInNav) {
    links.push({ key: "creative-hub", href: creativeHub.url, label: "Creative Hub", external: true });
  }

  container.innerHTML = links
    .map(({ key, href, label, external }) => {
      const active = key === current ? " is-active" : "";
      const target = external && creativeHub.openMode !== "same-tab" ? ' target="_blank" rel="noreferrer"' : "";
      return `<a class="page-nav__link${active}" href="${href}"${target} data-key="${key}">${label}</a>`;
    })
    .join("");

  container.classList.remove("page-nav--sidebar", "page-nav--header");
  container.classList.add(isSidebarNav ? "page-nav--sidebar" : "page-nav--header");

  if (isSidebarNav) {
    container.innerHTML = `
      <div class="sidebar-brand">
        <span class="sidebar-brand__logo">⚡</span>
        <div>
          <strong>Central</strong>
          <span>Command deck</span>
        </div>
      </div>
      <button type="button" class="page-nav__palette-btn" data-action="open-palette" aria-label="Open command palette to search or jump (Ctrl+K)">
        Search or jump
        <span aria-hidden="true">Ctrl+K</span>
      </button>
      <div class="sidebar-section">
        <p class="page-nav__section-label">Core</p>
        ${primaryLinks.map((link) => renderLink(link, current, creativeHub)).join("")}
      </div>
      ${renderProfileSection(current, "sidebar")}
      <div class="sidebar-section sidebar-section--secondary">
        <p class="page-nav__section-label">Browse</p>
        ${workspaceLinks.map((link) => renderLink(link, current, creativeHub)).join("")}
      </div>
      <div class="page-nav__auth-slot"></div>
    `;
  } else {
    container.innerHTML = `
      <div class="header-nav-shell">
        <a class="page-nav__brand" href="index.html" aria-label="Go to Central Command home">
          <span class="page-nav__brand-mark" aria-hidden="true">⚡</span>
          <span class="page-nav__brand-copy">
            <strong>Central Command</strong>
            <span>Daily command center</span>
          </span>
        </a>
        <div class="header-nav-links">
          ${primaryLinks.map((link) => renderHeaderLink(link, current)).join("")}
        </div>
        <div class="header-nav-links header-nav-links--secondary">
          ${workspaceLinks.map((link) => renderHeaderLink(link, current, creativeHub)).join("")}
        </div>
        ${renderProfileSection(current, "header", profileLinks)}
        <div class="header-nav-actions">
          <button type="button" class="page-nav__palette-btn" data-action="open-palette" aria-label="Open command palette (Ctrl+K)">
            Search
            <span aria-hidden="true">Ctrl+K</span>
          </button>
          <div class="page-nav__auth-slot"></div>
        </div>
      </div>
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

  bindCommandButtons(container);

  if (!isSidebarNav) setupMobileNav(container);
}

function renderLink(link, current, creativeHub) {
  const active = link.key === current ? " is-active" : "";
  const ariaCurrent = link.key === current ? ' aria-current="page"' : "";
  const target =
    link.external && creativeHub.openMode !== "same-tab" ? ' target="_blank" rel="noreferrer"' : "";
  return `<a class="page-nav__link sidebar-link${active}" href="${link.href}"${target}${ariaCurrent} data-key="${link.key}"><span class="sidebar-link__icon">${link.icon}</span><span>${link.label}</span></a>`;
}

function renderHeaderLink(link, current, creativeHub) {
  const active = link.key === current ? " is-active" : "";
  const ariaCurrent = link.key === current ? ' aria-current="page"' : "";
  const target =
    link.external && creativeHub?.openMode !== "same-tab" ? ' target="_blank" rel="noreferrer"' : "";
  return `<a class="page-nav__link${active}" href="${link.href}"${target}${ariaCurrent} data-key="${link.key}">${link.label}</a>`;
}

function renderProfileSection(current, mode = "header", links = []) {
  const cls = mode === "sidebar" ? "sidebar-profile" : "header-profile";
  const titleCls = mode === "sidebar" ? "sidebar-profile__title" : "header-profile__title";
  const childrenCls = mode === "sidebar" ? "sidebar-profile__children" : "header-profile__children";
  const childCls = mode === "sidebar" ? "sidebar-profile__child" : "header-profile__child";
  const profileLinks =
    links.length > 0
      ? links
      : [
          { key: "profile", href: "profile.html", label: "Profile" },
          { key: "admin", href: "admin.html", label: "Admin" },
          { key: "settings", href: "settings.html", label: "Settings" },
        ];
  return `
    <div class="${cls}">
      <a class="page-nav__link ${titleCls}${current === "profile" ? " is-active" : ""}" href="profile.html" data-key="profile"${current === "profile" ? ' aria-current="page"' : ""}>👤 Profile</a>
      <div class="${childrenCls}">
        ${profileLinks
          .map(
            (item) =>
              item.key === "profile"
                ? ""
                :
              `<a class="page-nav__link ${childCls}${item.key === current ? " is-active" : ""}" href="${item.href}" data-key="${item.key}"${item.key === current ? ' aria-current="page"' : ""}>${item.label}</a>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function bindCommandButtons(container) {
  container.querySelectorAll('[data-action="open-palette"]').forEach((button) => {
    button.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("central-command:open-palette"));
    });
  });
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
    if (open) {
      requestAnimationFrame(() => {
        const firstLink = nav.querySelector(".page-nav__link");
        firstLink?.focus();
      });
    }
  }

  function getDrawerFocusables() {
    if (!bar.classList.contains("is-open")) return [];
    const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(nav.querySelectorAll(sel));
  }

  btn.addEventListener("click", () => setOpen(!bar.classList.contains("is-open")));

  nav.querySelectorAll(".page-nav__link").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && bar.classList.contains("is-open")) setOpen(false);
    if (e.key !== "Tab" || !bar.classList.contains("is-open")) return;
    const focusables = getDrawerFocusables();
    if (focusables.length < 2) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}
