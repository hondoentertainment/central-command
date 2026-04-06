/**
 * Auth UI: email login, account creation, password reset, and sign out.
 * Renders in nav or hero.
 */

import {
  initFirebase,
  isFirebaseConfigured,
  onAuthStateChanged,
  signInWithEmailPassword,
  createUserWithEmailPassword,
  sendPasswordReset,
  sendVerificationEmailForCurrentUser,
  refreshCurrentUser,
  changePassword,
  signInAnonymously,
  signOut,
  getAuthInstance,
} from "./firebase.js";
import { evaluatePasswordStrength, mapAuthError } from "./auth-policy.js";
import { showPromptDialog } from "./confirm-dialog.js";
import { recordSecurityEvent } from "./storage.js";

const AUTH_UI_CONTAINER_ID = "authSlot";

/**
 * Render auth UI into the given container.
 * Shows login panel when signed out, account controls when signed in.
 * Hides entirely when Firebase is not configured.
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {() => void} [options.onAuthChange] - Called when auth state changes (e.g. to trigger sync)
 */
export function renderAuthUI(container, options = {}) {
  if (!container) return () => {};

  let currentUser = null;
  let panelOpen = false;

  function updateUI() {
    container.innerHTML = "";
    container.hidden = true;

    if (!isFirebaseConfigured()) return;

    const auth = getAuthInstance();
    if (!auth) return;

    container.hidden = false;

    if (currentUser) {
      const badge = document.createElement("span");
      badge.className = `auth-ui__badge auth-ui__badge--${getAccountStateClass(currentUser)}`;
      badge.textContent = getAccountStateLabel(currentUser);

      const signedIn = document.createElement("span");
      signedIn.className = "auth-ui__signed-in";
      signedIn.textContent = currentUser.email
        ? `Signed in: ${currentUser.email}`
        : "Signed in";

      const signOutBtn = document.createElement("button");
      signOutBtn.type = "button";
      signOutBtn.className = "auth-ui__sign-out ghost-button";
      signOutBtn.textContent = "Sign out";
      signOutBtn.addEventListener("click", async () => {
        signOutBtn.disabled = true;
        try {
          await signOut();
          recordSecurityEvent("sign_out");
        } finally {
          signOutBtn.disabled = false;
        }
      });

      container.append(badge, signedIn, signOutBtn);

      if (!currentUser.isAnonymous && !currentUser.emailVerified) {
        const verifyActions = document.createElement("div");
        verifyActions.className = "auth-ui__verify-actions";

        const verifyHint = document.createElement("span");
        verifyHint.className = "auth-ui__verify-hint";
        verifyHint.textContent = "Verify your email to enable cloud sync.";

        const resendBtn = document.createElement("button");
        resendBtn.type = "button";
        resendBtn.className = "ghost-button auth-ui__verify-btn";
        resendBtn.textContent = "Resend verification";
        resendBtn.addEventListener("click", async () => {
          resendBtn.disabled = true;
          try {
            await sendVerificationEmailForCurrentUser();
            recordSecurityEvent("email_verification_sent", { source: "auth-ui" });
            verifyHint.textContent = "Verification email sent.";
          } catch (err) {
            verifyHint.textContent = mapAuthError(err);
          } finally {
            resendBtn.disabled = false;
          }
        });

        const refreshBtn = document.createElement("button");
        refreshBtn.type = "button";
        refreshBtn.className = "ghost-button auth-ui__verify-btn";
        refreshBtn.textContent = "Refresh status";
        refreshBtn.addEventListener("click", async () => {
          refreshBtn.disabled = true;
          try {
            await refreshCurrentUser();
            verifyHint.textContent = "Status refreshed.";
          } catch (err) {
            verifyHint.textContent = mapAuthError(err);
          } finally {
            refreshBtn.disabled = false;
          }
        });

        verifyActions.append(verifyHint, resendBtn, refreshBtn);
        container.append(verifyActions);
      }
    } else {
      const loginBtn = document.createElement("button");
      loginBtn.type = "button";
      loginBtn.className = "auth-ui__sign-in ghost-button";
      loginBtn.textContent = panelOpen ? "Close login" : "Log in";
      loginBtn.setAttribute("aria-label", "Log in with email and password");
      loginBtn.addEventListener("click", () => {
        panelOpen = !panelOpen;
        updateUI();
      });
      container.append(loginBtn);

      if (!panelOpen) return;

      const panel = document.createElement("div");
      panel.className = "auth-ui__panel";

      const emailInput = document.createElement("input");
      emailInput.type = "email";
      emailInput.className = "auth-ui__input";
      emailInput.placeholder = "Email";
      emailInput.autocomplete = "email";

      const passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.className = "auth-ui__input";
      passwordInput.placeholder = "Password";
      passwordInput.autocomplete = "current-password";
      passwordInput.minLength = 8;

      const strength = document.createElement("p");
      strength.className = "auth-ui__strength";
      strength.textContent = "Password strength: N/A";

      const status = document.createElement("p");
      status.className = "auth-ui__status";
      status.setAttribute("aria-live", "polite");

      const actions = document.createElement("div");
      actions.className = "auth-ui__actions";

      const signInBtn = document.createElement("button");
      signInBtn.type = "button";
      signInBtn.className = "ghost-button auth-ui__action";
      signInBtn.textContent = "Sign in";

      const createBtn = document.createElement("button");
      createBtn.type = "button";
      createBtn.className = "ghost-button auth-ui__action";
      createBtn.textContent = "Create account";

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "ghost-button auth-ui__action";
      resetBtn.textContent = "Reset password";

      const guestBtn = document.createElement("button");
      guestBtn.type = "button";
      guestBtn.className = "ghost-button auth-ui__action";
      guestBtn.textContent = "Continue as guest";

      const setBusy = (busy) => {
        [signInBtn, createBtn, resetBtn, guestBtn, emailInput, passwordInput].forEach((el) => {
          el.disabled = busy;
        });
      };

      const setStatus = (message, tone = "info") => {
        status.textContent = message;
        status.className = `auth-ui__status is-${tone}`;
      };

      const requireEmail = () => {
        const email = emailInput.value.trim();
        if (!email) {
          setStatus("Enter your email address first.", "error");
          emailInput.focus();
          return null;
        }
        return email;
      };

      const refreshStrength = () => {
        const result = evaluatePasswordStrength(passwordInput.value);
        strength.textContent = `Password strength: ${result.label}`;
        strength.className = `auth-ui__strength is-score-${result.score}`;
      };

      passwordInput.addEventListener("input", refreshStrength);
      refreshStrength();

      signInBtn.addEventListener("click", async () => {
        const email = requireEmail();
        const password = passwordInput.value;
        if (!email || !password) {
          setStatus("Enter email and password to sign in.", "error");
          return;
        }
        setBusy(true);
        setStatus("Signing in...");
        try {
          await signInWithEmailPassword(email, password);
          recordSecurityEvent("login_success", { method: "email" });
          panelOpen = false;
          setStatus("Signed in.", "success");
        } catch (err) {
          console.warn("Email sign in failed:", err?.message);
          recordSecurityEvent("login_failure", { method: "email", code: err?.code ?? "unknown" });
          setStatus(mapAuthError(err), "error");
        } finally {
          setBusy(false);
        }
      });

      createBtn.addEventListener("click", async () => {
        const email = requireEmail();
        const password = passwordInput.value;
        if (!email || !password) {
          setStatus("Enter email and password to create account.", "error");
          return;
        }
        const passwordPolicy = evaluatePasswordStrength(password);
        if (!passwordPolicy.isValid) {
          setStatus("Use at least 8 characters with mixed case, number, and symbol.", "error");
          return;
        }
        setBusy(true);
        setStatus("Creating account...");
        try {
          await createUserWithEmailPassword(email, password);
          await sendVerificationEmailForCurrentUser();
          recordSecurityEvent("account_created", { method: "email" });
          recordSecurityEvent("email_verification_sent", { source: "signup" });
          panelOpen = false;
          setStatus("Account created. Check your email to verify.", "success");
        } catch (err) {
          console.warn("Create account failed:", err?.message);
          setStatus(mapAuthError(err), "error");
        } finally {
          setBusy(false);
        }
      });

      resetBtn.addEventListener("click", async () => {
        const email = requireEmail();
        if (!email) return;
        setBusy(true);
        setStatus("Sending password reset email...");
        try {
          await sendPasswordReset(email);
          recordSecurityEvent("password_reset_requested");
          setStatus("Password reset email sent.", "success");
        } catch (err) {
          console.warn("Password reset failed:", err?.message);
          setStatus(mapAuthError(err), "error");
        } finally {
          setBusy(false);
        }
      });

      guestBtn.addEventListener("click", async () => {
        setBusy(true);
        setStatus("Signing in as guest...");
        try {
          await signInAnonymously();
          recordSecurityEvent("login_success", { method: "guest" });
          panelOpen = false;
        } catch (err) {
          console.warn("Guest sign in failed:", err?.message);
          setStatus(mapAuthError(err), "error");
        } finally {
          setBusy(false);
        }
      });

      const changePassBtn = document.createElement("button");
      changePassBtn.type = "button";
      changePassBtn.className = "ghost-button auth-ui__action";
      changePassBtn.textContent = "Change password";
      changePassBtn.addEventListener("click", async () => {
        const email = requireEmail();
        const current = passwordInput.value;
        if (!email || !current) {
          setStatus("Enter email and current password first.", "error");
          return;
        }
        const next = await showPromptDialog({
          title: "Change password",
          message: "Enter a new password (8+ characters, mixed case, number, and symbol).",
          placeholder: "New password",
          confirmLabel: "Update",
        });
        if (!next) return;
        const policy = evaluatePasswordStrength(next);
        if (!policy.isValid) {
          setStatus("New password does not meet policy.", "error");
          return;
        }
        setBusy(true);
        setStatus("Updating password...");
        try {
          await changePassword(current, next);
          recordSecurityEvent("password_changed");
          setStatus("Password changed. Other sessions may be signed out.", "success");
        } catch (err) {
          setStatus(mapAuthError(err), "error");
        } finally {
          setBusy(false);
        }
      });

      const hint = document.createElement("p");
      hint.className = "auth-ui__hint";
      hint.textContent = "Use email/password to sync across devices.";

      actions.append(signInBtn, createBtn, resetBtn, guestBtn, changePassBtn);
      panel.append(emailInput, passwordInput, strength, actions, status, hint);
      container.append(panel);
    }
  }

  let unsubscribe = () => {};

  initFirebase().then(() => {
    unsubscribe = onAuthStateChanged((user) => {
      currentUser = user;
      updateUI();
      options.onAuthChange?.(user);
    });
  });

  return () => {
    unsubscribe?.();
  };
}

function getAccountStateLabel(user) {
  if (user?.isAnonymous) return "Guest";
  if (!user?.emailVerified) return "Unverified";
  return "Verified";
}

function getAccountStateClass(user) {
  if (user?.isAnonymous) return "guest";
  if (!user?.emailVerified) return "unverified";
  return "verified";
}

/**
 * Get or create the auth container in the nav. Call from renderNav.
 * @param {HTMLElement} navContainer - The #pageNav container
 * @returns {HTMLElement|null}
 */
export function getOrCreateAuthSlot(navContainer) {
  if (!navContainer) return null;
  const placeholder = navContainer.querySelector(".page-nav__auth-slot");
  let slot = document.getElementById(AUTH_UI_CONTAINER_ID);
  if (!slot) {
    slot = document.createElement("div");
    slot.id = AUTH_UI_CONTAINER_ID;
    slot.className = "auth-ui";
    slot.setAttribute("aria-live", "polite");
    (placeholder || navContainer).appendChild(slot);
  } else if (placeholder && slot.parentElement !== placeholder) {
    placeholder.appendChild(slot);
  }
  return slot;
}
