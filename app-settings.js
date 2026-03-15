import { renderNav } from "./lib/nav.js";
import { getTheme, setTheme, initTheme } from "./lib/theme.js";

const elements = {
  themeSettingsForm: document.querySelector("#themeSettingsForm"),
  themeDark: document.querySelector("#themeDark"),
  themeLight: document.querySelector("#themeLight"),
  themeStatus: document.querySelector("#themeStatus"),
};

initialize();

function initialize() {
  renderNav("settings");
  initTheme();
  applyThemeSelection(getTheme());

  elements.themeSettingsForm?.addEventListener("change", handleThemeChange);
}

function handleThemeChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.name !== "theme") return;
  setTheme(target.value);
  setStatus(`Theme set to ${target.value}.`);
}

function applyThemeSelection(theme) {
  const normalized = theme === "light" ? "light" : "dark";
  if (elements.themeDark) elements.themeDark.checked = normalized === "dark";
  if (elements.themeLight) elements.themeLight.checked = normalized === "light";
  setStatus(`Current theme: ${normalized}.`);
}

function setStatus(message) {
  if (!elements.themeStatus) return;
  elements.themeStatus.textContent = message;
  elements.themeStatus.className = "form-message is-info";
}
