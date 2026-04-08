import { renderAuthUI, getOrCreateAuthSlot } from "./auth-ui.js";
import { initCommandPalette } from "./command-palette.js";
import { initKeyboardHelp } from "./keyboard-help.js";
import { initTheme } from "./theme.js";
import { loadIntegrationsPreferences } from "./storage.js";
import { getCreativeHubConfig, openCreativeHub, trackIntegrationEvent } from "./integrations.js";
import { showToast } from "./toast.js";
import { loadWorkspaces, setActiveWorkspaceId, getActiveWorkspace } from "./workspaces.js";

/** Only init view transitions once */
let viewTransitionsInitialized = false;

/**
 * Intercepts internal link clicks and uses the View Transitions API (where supported)
 * to animate page navigations. Falls back to normal navigation in unsupported browsers.
 */
function initViewTransitions() {
  if (viewTransitionsInitialized) return;
  viewTransitionsInitialized = true;

  if (typeof document === "undefined") return;
  if (!document.startViewTransition) return;

  // Determine which hrefs are internal same-origin HTML pages
  const isInternalLink = (anchor) => {
    if (!anchor || !anchor.href) return false;
    if (anchor.target === "_blank") return false;
    if (anchor.hasAttribute("download")) return false;
    try {
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return false;
      if (!url.pathname.endsWith(".html") && url.pathname !== "/" && !url.pathname.endsWith("/")) return false;
      return true;
    } catch {
      return false;
    }
  };

  document.addEventListener("click", (e) => {
    const anchor = e.target.closest("a[href]");
    if (!anchor) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!isInternalLink(anchor)) return;
    // Skip if prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    e.preventDefault();
    const href = anchor.href;

    document.startViewTransition(() => {
      window.location.href = href;
    });
  });
}

/** Only init command palette once */
let commandPaletteInitialized = false;

/** Only init keyboard help once */
let keyboardHelpInitialized = false;

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
  initViewTransitions();
  if (!commandPaletteInitialized) {
    commandPaletteInitialized = true;
    initCommandPalette();
  }
  if (!keyboardHelpInitialized) {
    keyboardHelpInitialized = true;
    initKeyboardHelp();
  }
  const container = document.querySelector("#pageNav");
  if (!container) return;

  const integrationPrefs = loadIntegrationsPreferences();
  const creativeHub = getCreativeHubConfig(integrationPrefs);

  const workspaces = loadWorkspaces();
  const activeWorkspace = getActiveWorkspace(workspaces);

  const primaryLinks = [
    { key: "command", href: "index.html", label: "Home" },
    { key: "tasks", href: "tasks.html", label: "Tasks" },
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
      <div class="topbar__workspace">
        <button type="button" class="topbar__workspace-btn" id="workspaceSwitcher" aria-haspopup="true" aria-expanded="false">
          <span class="topbar__workspace-icon">${activeWorkspace.icon}</span>
          <span class="topbar__workspace-name">${activeWorkspace.name}</span>
        </button>
        <div class="topbar__workspace-dropdown" id="workspaceDropdown" hidden>
          ${workspaces.map((ws) => {
            const activeClass = ws.id === activeWorkspace.id ? " is-active" : "";
            return `<button type="button" class="topbar__workspace-option${activeClass}" data-workspace-id="${ws.id}">${ws.icon} ${ws.name}</button>`;
          }).join("")}
        </div>
      </div>
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

  // Announce route change to screen readers
  announcePageChange(current);

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
  bindWorkspaceSwitcher(container);
  setupMobileNav(container);
}

/** Map nav keys to human-readable page names for screen reader announcements. */
const PAGE_NAMES = {
  command: "Home",
  registry: "Tools",
  tasks: "Tasks",
  projects: "Projects",
  history: "History",
  runbook: "Runbook",
  profile: "Profile",
  admin: "Admin",
  settings: "Settings",
  agents: "Agents",
  packs: "Starter Packs",
  productivity: "Productivity",
  writing: "Writing",
  sports: "Sports",
  games: "Games",
  health: "Health",
  music: "Music",
  movies: "Movies",
  parties: "Parties",
};

/**
 * Announce a page navigation to screen readers via the statusAnnouncer live region.
 * @param {string} pageKey
 */
function announcePageChange(pageKey) {
  const announcer = document.querySelector("#statusAnnouncer");
  if (!announcer) return;
  const pageName = PAGE_NAMES[pageKey] || pageKey;
  // Clear then set to force the live region to re-announce
  announcer.textContent = "";
  requestAnimationFrame(() => {
    announcer.textContent = `Page: ${pageName}`;
  });
}

function renderNavLink(link, current, creativeHub) {
  const active = link.key === current ? " is-active" : "";
  const ariaCurrent = link.key === current ? ' aria-current="page"' : "";
  const target =
    link.external && creativeHub?.openMode !== "same-tab" ? ' target="_blank" rel="noreferrer"' : "";
  return `<a class="topbar__link${active}" href="${link.href}"${target}${ariaCurrent} data-key="${link.key}">${link.label}</a>`;
}

function bindWorkspaceSwitcher(container) {
  const btn = container.querySelector("#workspaceSwitcher");
  const dropdown = container.querySelector("#workspaceDropdown");
  if (!btn || !dropdown) return;

  btn.addEventListener("click", () => {
    const isOpen = !dropdown.hidden;
    dropdown.hidden = isOpen;
    btn.setAttribute("aria-expanded", String(!isOpen));
  });

  dropdown.querySelectorAll("[data-workspace-id]").forEach((option) => {
    option.addEventListener("click", () => {
      const id = option.getAttribute("data-workspace-id");
      setActiveWorkspaceId(id);
      location.reload();
    });
  });

  document.addEventListener("click", (e) => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });
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
