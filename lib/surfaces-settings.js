/**
 * Surfaces visibility and integration settings for the Command Deck page.
 */
import {
  loadSurfacesPreferences,
  saveSurfacesPreferences,
  loadIntegrationsPreferences,
  saveIntegrationsPreferences,
} from "./storage.js";
import {
  sanitizeIntegrationsPreferences,
  validateIntegrationUrl,
} from "./integrations.js";
import { renderNav } from "./nav.js";
import { showToast } from "./toast.js";

const DEFAULT_SURFACES = { command: ["hero", "spotlight"] };

export function getSurfacesForPage(pageKey) {
  const prefs = loadSurfacesPreferences();
  const surfaces = prefs?.[pageKey];
  if (Array.isArray(surfaces)) return surfaces;
  return DEFAULT_SURFACES[pageKey] ?? ["hero", "spotlight"];
}

export function applySurfacesVisibility(pageKey, elements) {
  const surfaces = getSurfacesForPage(pageKey);
  if (elements.heroSection) elements.heroSection.hidden = !surfaces.includes("hero");
  if (elements.spotlightSection) elements.spotlightSection.hidden = !surfaces.includes("spotlight");
}

export function setupSurfacesSettings(elements) {
  const prefs = loadSurfacesPreferences();
  const surfaces = prefs?.command ?? DEFAULT_SURFACES.command;
  if (elements.surfacesShowHero) elements.surfacesShowHero.checked = surfaces.includes("hero");
  if (elements.surfacesShowSpotlight) elements.surfacesShowSpotlight.checked = surfaces.includes("spotlight");

  elements.surfacesSettingsBtn?.addEventListener("click", () => {
    const panel = elements.surfacesSettingsPanel;
    if (!panel) return;
    panel.hidden = !panel.hidden;
    elements.surfacesSettingsBtn?.setAttribute("aria-expanded", String(!panel.hidden));
  });

  const updateFromCheckboxes = () => {
    const showHero = elements.surfacesShowHero?.checked ?? true;
    const showSpotlight = elements.surfacesShowSpotlight?.checked ?? true;
    const surfaces = [];
    if (showHero) surfaces.push("hero");
    if (showSpotlight) surfaces.push("spotlight");
    const prefs = loadSurfacesPreferences() ?? {};
    prefs.command = surfaces;
    saveSurfacesPreferences(prefs);
    applySurfacesVisibility("command", elements);
  };

  elements.surfacesShowHero?.addEventListener("change", updateFromCheckboxes);
  elements.surfacesShowSpotlight?.addEventListener("change", updateFromCheckboxes);
}

export function getIntegrationPrefs() {
  return sanitizeIntegrationsPreferences(loadIntegrationsPreferences());
}

export function setupIntegrationSettings(elements, render) {
  const prefs = getIntegrationPrefs();
  const creativeHub = prefs.creativeHub;

  if (elements.creativeHubEnabled) elements.creativeHubEnabled.checked = creativeHub.enabled;
  if (elements.creativeHubShowInNav) elements.creativeHubShowInNav.checked = creativeHub.showInNav;
  if (elements.creativeHubShowInPalette) elements.creativeHubShowInPalette.checked = creativeHub.showInCommandPalette;
  if (elements.creativeHubShowAsTool) elements.creativeHubShowAsTool.checked = creativeHub.showAsTool;
  if (elements.creativeHubUrl) elements.creativeHubUrl.value = creativeHub.url;
  if (elements.creativeHubOpenMode) elements.creativeHubOpenMode.value = creativeHub.openMode;

  const savePrefs = () => {
    const urlValidation = validateIntegrationUrl(elements.creativeHubUrl?.value);
    if (!urlValidation.isValid) {
      showToast("Creative Hub URL is invalid. Using default URL.", "error");
    }

    const next = sanitizeIntegrationsPreferences({
      creativeHub: {
        enabled: elements.creativeHubEnabled?.checked ?? true,
        showInNav: elements.creativeHubShowInNav?.checked ?? true,
        showInCommandPalette: elements.creativeHubShowInPalette?.checked ?? true,
        showAsTool: elements.creativeHubShowAsTool?.checked ?? true,
        url: urlValidation.url,
        openMode: elements.creativeHubOpenMode?.value,
      },
    });

    if (elements.creativeHubUrl) {
      elements.creativeHubUrl.value = next.creativeHub.url;
    }

    saveIntegrationsPreferences(next);
    renderNav("command");
    render();
  };

  [
    elements.creativeHubEnabled,
    elements.creativeHubShowInNav,
    elements.creativeHubShowInPalette,
    elements.creativeHubShowAsTool,
    elements.creativeHubOpenMode,
  ].forEach((el) => el?.addEventListener("change", savePrefs));

  elements.creativeHubUrl?.addEventListener("blur", savePrefs);
}
