import { renderNav } from "./lib/nav.js";
import { getTheme, setTheme, initTheme } from "./lib/theme.js";
import {
  initFirebase,
  isFirebaseConfigured,
  onAuthStateChanged,
  sendVerificationEmailForCurrentUser,
  refreshCurrentUser,
  changePassword,
} from "./lib/firebase.js";
import { evaluatePasswordStrength, getAccountTier, mapAuthError } from "./lib/auth-policy.js";
import { recordSecurityEvent, loadIntegrationsPreferences, saveIntegrationsPreferences } from "./lib/storage.js";
import { sanitizeIntegrationsPreferences, validateIntegrationUrl, checkIntegrationHealth } from "./lib/integrations.js";

const elements = {
  themeSettingsForm: document.querySelector("#themeSettingsForm"),
  themeDark: document.querySelector("#themeDark"),
  themeLight: document.querySelector("#themeLight"),
  themeStatus: document.querySelector("#themeStatus"),
  accountSecurityMeta: document.querySelector("#accountSecurityMeta"),
  accountSecurityStatus: document.querySelector("#accountSecurityStatus"),
  resendVerificationBtn: document.querySelector("#resendVerificationBtn"),
  refreshAccountBtn: document.querySelector("#refreshAccountBtn"),
  currentPasswordInput: document.querySelector("#currentPasswordInput"),
  newPasswordInput: document.querySelector("#newPasswordInput"),
  changePasswordBtn: document.querySelector("#changePasswordBtn"),
  settingsCreativeHubEnabled: document.querySelector("#settingsCreativeHubEnabled"),
  settingsCreativeHubShowInNav: document.querySelector("#settingsCreativeHubShowInNav"),
  settingsCreativeHubShowInPalette: document.querySelector("#settingsCreativeHubShowInPalette"),
  settingsCreativeHubShowAsTool: document.querySelector("#settingsCreativeHubShowAsTool"),
  settingsCreativeHubUrl: document.querySelector("#settingsCreativeHubUrl"),
  settingsCreativeHubOpenMode: document.querySelector("#settingsCreativeHubOpenMode"),
  integrationsStatus: document.querySelector("#integrationsStatus"),
  integrationUrlHealth: document.querySelector("#integrationUrlHealth"),
};

let accountControlsEnabled = false;
let accountControlsBusy = false;

initialize();

async function initialize() {
  renderNav("settings");
  initTheme();
  applyThemeSelection(getTheme());

  elements.themeSettingsForm?.addEventListener("change", handleThemeChange);
  initializeIntegrations();
  await initializeAccountSecurity();
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

async function initializeAccountSecurity() {
  await initFirebase();
  if (!isFirebaseConfigured()) {
    setAccountMeta("Firebase config missing. Account security tools are unavailable.");
    setAccountFormEnabled(false);
    return;
  }

  onAuthStateChanged((user) => {
    const tier = getAccountTier(user);
    if (!user || tier === "signed-out") {
      setAccountMeta("Signed out. Sign in to manage account security.");
      setAccountFormEnabled(false);
      return;
    }

    const signedInAt = user?.metadata?.lastSignInTime
      ? new Date(user.metadata.lastSignInTime).toLocaleString()
      : "unknown";
    const tierLabel =
      tier === "guest" ? "Guest" : tier === "unverified" ? "Unverified" : "Verified";
    const email = user.email || "No email";
    setAccountMeta(`${email} · ${tierLabel} · Last sign in ${signedInAt}`);
    setAccountFormEnabled(!user.isAnonymous);
  });

  elements.resendVerificationBtn?.addEventListener("click", async () => {
    setAccountBusy(true);
    setAccountStatus("Sending verification email...");
    try {
      await sendVerificationEmailForCurrentUser();
      recordSecurityEvent("email_verification_sent", { source: "settings" });
      setAccountStatus("Verification email sent.", "success");
    } catch (err) {
      setAccountStatus(mapAuthError(err), "error");
    } finally {
      setAccountBusy(false);
    }
  });

  elements.refreshAccountBtn?.addEventListener("click", async () => {
    setAccountBusy(true);
    setAccountStatus("Refreshing account status...");
    try {
      await refreshCurrentUser();
      setAccountStatus("Account status refreshed.", "success");
    } catch (err) {
      setAccountStatus(mapAuthError(err), "error");
    } finally {
      setAccountBusy(false);
    }
  });

  elements.changePasswordBtn?.addEventListener("click", async () => {
    const currentPassword = elements.currentPasswordInput?.value ?? "";
    const nextPassword = elements.newPasswordInput?.value ?? "";
    if (!currentPassword || !nextPassword) {
      setAccountStatus("Enter both current and new password.", "error");
      return;
    }
    const policy = evaluatePasswordStrength(nextPassword);
    if (!policy.isValid) {
      setAccountStatus(
        "New password must be 8+ chars and include mixed case, number, and symbol.",
        "error"
      );
      return;
    }

    setAccountBusy(true);
    setAccountStatus("Updating password...");
    try {
      await changePassword(currentPassword, nextPassword);
      recordSecurityEvent("password_changed");
      if (elements.currentPasswordInput) elements.currentPasswordInput.value = "";
      if (elements.newPasswordInput) elements.newPasswordInput.value = "";
      setAccountStatus("Password updated successfully.", "success");
    } catch (err) {
      setAccountStatus(mapAuthError(err), "error");
    } finally {
      setAccountBusy(false);
    }
  });
}

function setAccountMeta(message) {
  if (!elements.accountSecurityMeta) return;
  elements.accountSecurityMeta.textContent = message;
  elements.accountSecurityMeta.className = "form-message is-info";
}

function setAccountStatus(message, tone = "info") {
  if (!elements.accountSecurityStatus) return;
  elements.accountSecurityStatus.textContent = message;
  elements.accountSecurityStatus.className = `form-message is-${tone}`;
}

function setAccountFormEnabled(enabled) {
  accountControlsEnabled = !!enabled;
  applyAccountControlDisabledState();
}

function setAccountBusy(busy) {
  accountControlsBusy = !!busy;
  applyAccountControlDisabledState();
}

function applyAccountControlDisabledState() {
  const disabled = !accountControlsEnabled || accountControlsBusy;
  [
    elements.resendVerificationBtn,
    elements.refreshAccountBtn,
    elements.currentPasswordInput,
    elements.newPasswordInput,
    elements.changePasswordBtn,
  ].forEach((el) => {
    if (!el) return;
    el.disabled = disabled;
  });
}

function initializeIntegrations() {
  const prefs = sanitizeIntegrationsPreferences(loadIntegrationsPreferences());
  const ch = prefs.creativeHub;

  if (elements.settingsCreativeHubEnabled) elements.settingsCreativeHubEnabled.checked = ch.enabled;
  if (elements.settingsCreativeHubShowInNav) elements.settingsCreativeHubShowInNav.checked = ch.showInNav;
  if (elements.settingsCreativeHubShowInPalette) elements.settingsCreativeHubShowInPalette.checked = ch.showInCommandPalette;
  if (elements.settingsCreativeHubShowAsTool) elements.settingsCreativeHubShowAsTool.checked = ch.showAsTool;
  if (elements.settingsCreativeHubUrl) elements.settingsCreativeHubUrl.value = ch.url;
  if (elements.settingsCreativeHubOpenMode) elements.settingsCreativeHubOpenMode.value = ch.openMode;

  const saveIntegration = () => {
    const urlValidation = validateIntegrationUrl(elements.settingsCreativeHubUrl?.value);
    const next = sanitizeIntegrationsPreferences({
      creativeHub: {
        enabled: elements.settingsCreativeHubEnabled?.checked ?? true,
        showInNav: elements.settingsCreativeHubShowInNav?.checked ?? true,
        showInCommandPalette: elements.settingsCreativeHubShowInPalette?.checked ?? true,
        showAsTool: elements.settingsCreativeHubShowAsTool?.checked ?? true,
        url: urlValidation.url,
        openMode: elements.settingsCreativeHubOpenMode?.value,
      },
    });

    if (elements.settingsCreativeHubUrl) {
      elements.settingsCreativeHubUrl.value = next.creativeHub.url;
    }

    saveIntegrationsPreferences(next);

    if (!urlValidation.isValid) {
      setIntegrationsStatus("URL is invalid. Default URL applied.", "error");
    } else {
      setIntegrationsStatus("Integration settings saved.", "success");
    }
  };

  [
    elements.settingsCreativeHubEnabled,
    elements.settingsCreativeHubShowInNav,
    elements.settingsCreativeHubShowInPalette,
    elements.settingsCreativeHubShowAsTool,
    elements.settingsCreativeHubOpenMode,
  ].forEach((el) => el?.addEventListener("change", saveIntegration));

  elements.settingsCreativeHubUrl?.addEventListener("blur", () => {
    saveIntegration();
    runHealthCheck();
  });

  runHealthCheck();
}

function setIntegrationsStatus(message, tone = "info") {
  if (!elements.integrationsStatus) return;
  elements.integrationsStatus.textContent = message;
  elements.integrationsStatus.className = `form-message is-${tone}`;
  setTimeout(() => {
    if (elements.integrationsStatus) elements.integrationsStatus.textContent = "";
  }, 4000);
}

async function runHealthCheck() {
  const url = elements.settingsCreativeHubUrl?.value;
  if (!url || !elements.integrationUrlHealth) return;
  elements.integrationUrlHealth.textContent = "Checking URL…";
  elements.integrationUrlHealth.className = "form-message is-info";
  const result = await checkIntegrationHealth(url);
  if (result.ok) {
    elements.integrationUrlHealth.textContent = "URL is reachable.";
    elements.integrationUrlHealth.className = "form-message is-success";
  } else {
    elements.integrationUrlHealth.textContent = result.message || "URL may be unreachable.";
    elements.integrationUrlHealth.className = "form-message is-warning";
  }
}
