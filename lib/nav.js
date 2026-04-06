import { renderAuthUI, getOrCreateAuthSlot } from "./auth-ui.js";
import { initCommandPalette } from "./command-palette.js";
import { initTheme } from "./theme.js";
import { loadIntegrationsPreferences } from "./storage.js";
import { getCreativeHubConfig, openCreativeHub, trackIntegrationEvent } from "./integrations.js";
import { showToast } from "./toast.js";

/** Only init command palette once */
let commandPaletteInitialized = false;

/**
 * Renders the persistent top bar navigation. Call with current page key to mark active.
 * Profile and auth are always in the upper right.
 * On mobile (≤920px), wraps nav links in a hamburger menu but keeps profile visible.
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

  const primaryLinks = [
    { key: "command", href: "index.html", label: "Home" },
    { key: "projects", href: "projects.html", label: "Projects" },
    { key: "registry", href: "registry.html", label: "Tools" },
    { key: "history", href: "history.html", label: "History" },
    { key: "runbook", href: "runbook.html", label: "Runbook" },
  ];

  const browseGroups = [
    {
      label: "Work",
      links: [
        { key: "agents", href: "agents.html", label: "Agents" },
        { key: "packs", href: "packs.html", label: "Packs" },
        { key: "productivity", href: "productivity.html", label: "Productivity" },
        { key: "writing", href: "writing.html", label: "Writing" },
      ],
    },
    {
      label: "Play",
      links: [
        { key: "sports", href: "sports.html", label: "Sports" },
        { key: "games", href: "games.html", label: "Games" },
        { key: "health", href: "health.html", label: "Health" },
      ],
    },
    {
      label: "Media",
      links: [
        { key: "music", href: "music.html", label: "Music" },
        { key: "movies", href: "movies.html", label: "Movies" },
        { key: "parties", href: "parties.html", label: "Parties" },
      ],
    },
  ];

  if (creativeHub.enabled && creativeHub.showInNav) {
    browseGroups[0].links.push({
      key: "creative-hub",
      href: creativeHub.url,
      label: "Creative Hub",
      external: true,
    });
  }

  const profileLinks = [
    { key: "profile", href: "profile.html", label: "Profile" },
    { key: "admin", href: "admin.html", label: "Admin" },
    { key: "settings", href: "settings.html", label: "Settings" },
  ];

  container.classList.remove("page-nav--sidebar", "page-nav--header");
  container.classList.add("page-nav--header");

  container.innerHTML = `
    <div class="topbar">
      <a class="topbar__brand" href="index.html" aria-label="Go to Central Command home">
        <span class="topbar__brand-mark" aria-hidden="true">⚡</span>
        <strong class="topbar__brand-name">Central Command</strong>
      </a>
      <div class="topbar__nav" id="topbarNav">
        <div class="topbar__nav-primary">
          ${primaryLinks.map((link) => renderNavLink(link, current)).join("")}
        </div>
        <div class="topbar__nav-browse">
          ${browseGroups.map((group) => `
            <div class="topbar__browse-group">
              <span class="topbar__browse-label">${group.label}</span>
              ${group.links.map((link) => renderNavLink(link, current, creativeHub)).join("")}
            </div>
          `).join("")}
        </div>
      </div>
      <div class="topbar__right">
        <button type="button" class="topbar__search-btn" data-action="open-palette" aria-label="Open command palette (Ctrl+K)">
          Search <span aria-hidden="true">Ctrl+K</span>
        </button>
        <div class="topbar__profile">
          ${profileLinks.map((link) => {
            const active = link.key === current ? " is-active" : "";
            const aria = link.key === current ? ' aria-current="page"' : "";
            return `<a class="topbar__profile-link${active}" href="${link.href}" data-key="${link.key}"${aria}>${link.label}</a>`;
          }).join("")}
        </div>
        <div class="page-nav__auth-slot"></div>
      </div>
    </div>
  `;

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
  setupMobileNav(container);
}

function renderNavLink(link, current, creativeHub) {
  const active = link.key === current ? " is-active" : "";
  const ariaCurrent = link.key === current ? ' aria-current="page"' : "";
  const target =
    link.external && creativeHub?.openMode !== "same-tab" ? ' target="_blank" rel="noreferrer"' : "";
  return `<a class="topbar__link${active}" href="${link.href}"${target}${ariaCurrent} data-key="${link.key}">${link.label}</a>`;
}

function bindCommandButtons(container) {
  container.querySelectorAll('[data-action="open-palette"]').forEach((button) => {
    button.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("central-command:open-palette"));
    });
  });
}

/**
 * Wraps nav in hamburger structure for mobile. Hamburger button toggles drawer.
 * Profile/auth stay visible outside the drawer.
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
        const firstLink = nav.querySelector(".topbar__link");
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

  nav.querySelectorAll(".topbar__link, .topbar__profile-link").forEach((link) => {
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
