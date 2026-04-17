import { renderNav } from "./lib/nav.js";
import { loadWorkspaces, saveWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace } from "./lib/workspaces.js";
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
import {
  INTEGRATION_DEFINITIONS,
  sanitizeIntegrationsPreferences,
  validateIntegrationUrl,
  checkIntegrationHealth,
} from "./lib/integrations.js";

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
  integrationsList: document.querySelector("#integrationsList"),
  integrationsStatus: document.querySelector("#integrationsStatus"),
  workspaceSettings: document.querySelector("#workspaceSettings"),
};

let accountControlsEnabled = false;
let accountControlsBusy = false;

initialize();

async function initialize() {
  renderNav("settings");
  initTheme();
  applyThemeSelection(getTheme());

  elements.themeSettingsForm?.addEventListener("change", handleThemeChange);
  initializeWorkspaceSettings();
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

function initializeWorkspaceSettings() {
  if (!elements.workspaceSettings) return;
  renderWorkspaceList();
}

function renderWorkspaceList() {
  const container = elements.workspaceSettings;
  if (!container) return;

  const workspaces = loadWorkspaces();

  const cards = workspaces.map((ws) => {
    const toolCount = ws.toolIds ? ws.toolIds.length : 0;
    const projectCount = ws.projectIds ? ws.projectIds.length : 0;
    const isAll = ws.id === "all";
    const deleteBtn = isAll
      ? ""
      : `<button type="button" class="ghost-button ghost-button--danger workspace-delete-btn" data-ws-id="${ws.id}">Delete</button>`;

    return `
      <div class="workspace-item" data-ws-id="${ws.id}">
        <span class="workspace-item__icon">${ws.icon}</span>
        <span class="workspace-item__name">${ws.name}</span>
        <span class="workspace-item__meta">${toolCount} tools, ${projectCount} projects</span>
        <button type="button" class="ghost-button workspace-edit-btn" data-ws-id="${ws.id}">Edit</button>
        ${deleteBtn}
      </div>`;
  }).join("");

  container.innerHTML = `
    ${cards}
    <button type="button" class="ghost-button" id="addWorkspaceBtn">+ Add workspace</button>
  `;

  container.querySelectorAll(".workspace-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-ws-id");
      const ws = workspaces.find((w) => w.id === id);
      if (ws) renderWorkspaceEditForm(ws);
    });
  });

  container.querySelectorAll(".workspace-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-ws-id");
      const updated = deleteWorkspace(loadWorkspaces(), id);
      saveWorkspaces(updated);
      renderWorkspaceList();
    });
  });

  container.querySelector("#addWorkspaceBtn")?.addEventListener("click", () => {
    renderWorkspaceEditForm(null);
  });
}

function renderWorkspaceEditForm(workspace) {
  const container = elements.workspaceSettings;
  if (!container) return;

  const isNew = !workspace;
  const name = workspace ? workspace.name : "";
  const icon = workspace ? workspace.icon : "\u{1F4CB}";
  const toolIds = workspace ? (workspace.toolIds || []).join(", ") : "";
  const projectIds = workspace ? (workspace.projectIds || []).join(", ") : "";

  container.innerHTML = `
    <form class="tool-form workspace-edit-form" id="workspaceEditForm">
      <label for="wsEditIcon">Icon
        <input type="text" id="wsEditIcon" value="${icon}" maxlength="4" style="width:60px" />
      </label>
      <label for="wsEditName">Name
        <input type="text" id="wsEditName" value="${name}" required />
      </label>
      <label for="wsEditToolIds">Tool IDs (comma-separated)
        <input type="text" id="wsEditToolIds" value="${toolIds}" placeholder="e.g. calculator, timer" />
      </label>
      <label for="wsEditProjectIds">Project IDs (comma-separated)
        <input type="text" id="wsEditProjectIds" value="${projectIds}" placeholder="e.g. project-alpha" />
      </label>
      <div class="tool-form__actions">
        <button type="submit" class="ghost-button">${isNew ? "Create" : "Save"}</button>
        <button type="button" class="ghost-button" id="wsEditCancel">Cancel</button>
      </div>
    </form>
  `;

  container.querySelector("#wsEditCancel")?.addEventListener("click", () => {
    renderWorkspaceList();
  });

  container.querySelector("#workspaceEditForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const newName = container.querySelector("#wsEditName")?.value.trim();
    const newIcon = container.querySelector("#wsEditIcon")?.value.trim() || "\u{1F4CB}";
    const newToolIds = container.querySelector("#wsEditToolIds")?.value
      .split(",").map((s) => s.trim()).filter(Boolean);
    const newProjectIds = container.querySelector("#wsEditProjectIds")?.value
      .split(",").map((s) => s.trim()).filter(Boolean);

    if (!newName) return;

    if (isNew) {
      createWorkspace({ name: newName, icon: newIcon, toolIds: newToolIds, projectIds: newProjectIds });
    } else {
      const updated = updateWorkspace(loadWorkspaces(), workspace.id, {
        name: newName,
        icon: newIcon,
        toolIds: newToolIds,
        projectIds: newProjectIds,
      });
      saveWorkspaces(updated);
    }

    renderWorkspaceList();
  });
}

function initializeIntegrations() {
  if (!elements.integrationsList) return;

  const renderIntegrations = () => {
    const prefs = sanitizeIntegrationsPreferences(loadIntegrationsPreferences());

    elements.integrationsList.innerHTML = INTEGRATION_DEFINITIONS.map((def) => {
      const cfg = prefs[def.id];
      const idPrefix = `settings-integration-${def.id}`;
      return `
        <fieldset class="settings-fieldset" data-integration-id="${def.id}">
          <legend>${def.icon ? `${def.icon} ` : ""}${escapeHtml(def.name)}</legend>
          <p class="panel__intro-text">${escapeHtml(def.description)}</p>
          <label class="checkbox">
            <input type="checkbox" data-field="enabled" id="${idPrefix}-enabled" ${cfg.enabled ? "checked" : ""} />
            <span>Enable ${escapeHtml(def.name)}</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" data-field="showInNav" id="${idPrefix}-nav" ${cfg.showInNav ? "checked" : ""} />
            <span>Show in navigation</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" data-field="showInCommandPalette" id="${idPrefix}-palette" ${cfg.showInCommandPalette ? "checked" : ""} />
            <span>Show in command palette</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" data-field="showAsTool" id="${idPrefix}-tool" ${cfg.showAsTool ? "checked" : ""} />
            <span>Show as tool card on home</span>
          </label>
          <label for="${idPrefix}-url">URL
            <input type="url" data-field="url" id="${idPrefix}-url" value="${escapeHtml(cfg.url)}" placeholder="${escapeHtml(def.defaultUrl)}" />
          </label>
          <label for="${idPrefix}-openmode">Open mode
            <select data-field="openMode" id="${idPrefix}-openmode">
              <option value="new-tab" ${cfg.openMode === "new-tab" ? "selected" : ""}>New tab</option>
              <option value="same-tab" ${cfg.openMode === "same-tab" ? "selected" : ""}>Same tab</option>
            </select>
          </label>
          <p class="form-message" data-role="health" role="status" aria-live="polite"></p>
        </fieldset>
      `;
    }).join("");

    elements.integrationsList.querySelectorAll("[data-integration-id]").forEach((fieldset) => {
      const id = fieldset.getAttribute("data-integration-id");
      const inputs = {
        enabled: fieldset.querySelector('[data-field="enabled"]'),
        showInNav: fieldset.querySelector('[data-field="showInNav"]'),
        showInCommandPalette: fieldset.querySelector('[data-field="showInCommandPalette"]'),
        showAsTool: fieldset.querySelector('[data-field="showAsTool"]'),
        url: fieldset.querySelector('[data-field="url"]'),
        openMode: fieldset.querySelector('[data-field="openMode"]'),
      };
      const healthEl = fieldset.querySelector('[data-role="health"]');

      const saveEntry = () => {
        const currentPrefs = sanitizeIntegrationsPreferences(loadIntegrationsPreferences());
        const urlValidation = validateIntegrationUrl(inputs.url?.value);
        const next = {
          ...currentPrefs,
          [id]: {
            enabled: inputs.enabled?.checked ?? currentPrefs[id]?.enabled ?? false,
            showInNav: inputs.showInNav?.checked ?? currentPrefs[id]?.showInNav ?? false,
            showInCommandPalette:
              inputs.showInCommandPalette?.checked ?? currentPrefs[id]?.showInCommandPalette ?? false,
            showAsTool: inputs.showAsTool?.checked ?? currentPrefs[id]?.showAsTool ?? false,
            url: urlValidation.url,
            openMode: inputs.openMode?.value ?? currentPrefs[id]?.openMode,
          },
        };
        const sanitized = sanitizeIntegrationsPreferences(next);
        if (inputs.url) inputs.url.value = sanitized[id].url;
        saveIntegrationsPreferences(sanitized);
        if (!urlValidation.isValid) {
          setIntegrationsStatus(`URL for ${id} is invalid. Default URL applied.`, "error");
        } else {
          setIntegrationsStatus("Integration settings saved.", "success");
        }
      };

      const runEntryHealth = async () => {
        if (!healthEl || !inputs.url?.value) return;
        healthEl.textContent = "Checking URL…";
        healthEl.className = "form-message is-info";
        const result = await checkIntegrationHealth(inputs.url.value);
        if (result.ok) {
          healthEl.textContent = "URL is reachable.";
          healthEl.className = "form-message is-success";
        } else {
          healthEl.textContent = result.message || "URL may be unreachable.";
          healthEl.className = "form-message is-warning";
        }
      };

      [inputs.enabled, inputs.showInNav, inputs.showInCommandPalette, inputs.showAsTool, inputs.openMode]
        .filter(Boolean)
        .forEach((el) => el.addEventListener("change", saveEntry));

      inputs.url?.addEventListener("blur", () => {
        saveEntry();
        runEntryHealth();
      });

      runEntryHealth();
    });
  };

  renderIntegrations();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function setIntegrationsStatus(message, tone = "info") {
  if (!elements.integrationsStatus) return;
  elements.integrationsStatus.textContent = message;
  elements.integrationsStatus.className = `form-message is-${tone}`;
  setTimeout(() => {
    if (elements.integrationsStatus) elements.integrationsStatus.textContent = "";
  }, 4000);
}
