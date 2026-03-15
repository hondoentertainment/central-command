/**
 * Theme toggle: light/dark mode with localStorage persistence.
 * Key: central-command.theme = "light" | "dark"
 * Classes: theme-light | theme-dark on document.documentElement
 * Default: dark
 */
const STORAGE_KEY = "central-command.theme";
const DEFAULT_THEME = "dark";

export function getTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : DEFAULT_THEME;
}

export function setTheme(theme) {
  const value = theme === "light" ? "light" : DEFAULT_THEME;
  document.documentElement.classList.remove("theme-light", "theme-dark");
  document.documentElement.classList.add(`theme-${value}`);
  localStorage.setItem(STORAGE_KEY, value);
  updateThemeColor(value);
}

export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

export function initTheme() {
  setTheme(getTheme());
}

function updateThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === "light" ? "#f0f4fa" : "#0f0f0f";
  }
}

/**
 * Create and return a theme toggle button for the nav.
 */
export function createThemeToggle() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle page-nav__link";
  button.setAttribute("aria-label", "Toggle light/dark mode");
  button.setAttribute("title", "Toggle light/dark mode");
  button.innerHTML = getThemeIcon(getTheme());
  button.addEventListener("click", () => {
    const next = toggleTheme();
    button.innerHTML = getThemeIcon(next);
  });
  return button;
}

function getThemeIcon(theme) {
  if (theme === "light") {
    return '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  return '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
}

