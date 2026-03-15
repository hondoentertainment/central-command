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

  const links = [
    { key: "command", href: "index.html", label: "Command" },
    { key: "registry", href: "registry.html", label: "Tool Registry" },
    { key: "agents", href: "agents.html", label: "Agents" },
    { key: "packs", href: "packs.html", label: "Starter Packs" },
    { key: "sports", href: "sports.html", label: "Sports" },
    { key: "games", href: "games.html", label: "Games" },
    { key: "health", href: "health.html", label: "Health" },
    { key: "writing", href: "writing.html", label: "Writing" },
    { key: "productivity", href: "productivity.html", label: "Productivity" },
    { key: "history", href: "history.html", label: "History" },
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

  container.appendChild(createProfileMenu(current));

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

  setupMobileNav(container);
}

function createProfileMenu(current) {
  const menu = document.createElement("div");
  menu.className = "profile-menu";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "profile-menu__button page-nav__link";
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Open profile menu");
  button.innerHTML = `
    <span class="profile-menu__avatar" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="8" r="4"></circle>
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"></path>
      </svg>
    </span>
    <span class="profile-menu__label">Profile</span>
  `;

  const panel = document.createElement("div");
  panel.className = "profile-menu__panel";
  panel.setAttribute("role", "menu");
  panel.hidden = true;

  const items = [
    { key: "profile", href: "profile.html", label: "Profile" },
    { key: "settings", href: "settings.html", label: "Settings" },
    { key: "admin", href: "admin.html", label: "Admin" },
  ];

  items.forEach((item) => {
    const link = document.createElement("a");
    link.href = item.href;
    link.className = `profile-menu__link page-nav__link${item.key === current ? " is-active" : ""}`;
    link.dataset.key = item.key;
    link.setAttribute("role", "menuitem");
    link.textContent = item.label;
    panel.appendChild(link);
  });

  const setOpen = (isOpen) => {
    panel.hidden = !isOpen;
    button.setAttribute("aria-expanded", String(isOpen));
    menu.classList.toggle("is-open", isOpen);
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    setOpen(panel.hidden);
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  panel.querySelectorAll(".profile-menu__link").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  menu.append(button, panel);
  return menu;
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
