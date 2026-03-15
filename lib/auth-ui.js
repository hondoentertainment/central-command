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
  signInAnonymously,
  signOut,
  getAuthInstance,
} from "./firebase.js";

const AUTH_UI_CONTAINER_ID = "authSlot";

/**
 * Render auth UI into the given container.
 * Shows "Sign in" / "Sync" when signed out, "Signed in" + Sign out when signed in.
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
        } finally {
          signOutBtn.disabled = false;
        }
      });

      container.append(signedIn, signOutBtn);
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
          panelOpen = false;
          setStatus("Signed in.", "success");
        } catch (err) {
          console.warn("Email sign in failed:", err?.message);
          setStatus(readableAuthError(err), "error");
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
        if (password.length < 6) {
          setStatus("Password must be at least 6 characters.", "error");
          return;
        }
        setBusy(true);
        setStatus("Creating account...");
        try {
          await createUserWithEmailPassword(email, password);
          panelOpen = false;
          setStatus("Account created and signed in.", "success");
        } catch (err) {
          console.warn("Create account failed:", err?.message);
          setStatus(readableAuthError(err), "error");
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
          setStatus("Password reset email sent.", "success");
        } catch (err) {
          console.warn("Password reset failed:", err?.message);
          setStatus(readableAuthError(err), "error");
        } finally {
          setBusy(false);
        }
      });

      guestBtn.addEventListener("click", async () => {
        setBusy(true);
        setStatus("Signing in as guest...");
        try {
          await signInAnonymously();
          panelOpen = false;
        } catch (err) {
          console.warn("Guest sign in failed:", err?.message);
          setStatus(readableAuthError(err), "error");
        } finally {
          setBusy(false);
        }
      });

      const hint = document.createElement("p");
      hint.className = "auth-ui__hint";
      hint.textContent = "Use email/password to sync across devices.";

      actions.append(signInBtn, createBtn, resetBtn, guestBtn);
      panel.append(emailInput, passwordInput, actions, status, hint);
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

function readableAuthError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-email")) return "That email address looks invalid.";
  if (code.includes("user-not-found")) return "No account found for that email.";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Incorrect email or password.";
  }
  if (code.includes("email-already-in-use")) return "That email is already in use.";
  if (code.includes("weak-password")) return "Password is too weak.";
  if (code.includes("too-many-requests")) return "Too many attempts. Try again later.";
  return err?.message || "Authentication failed. Please try again.";
}

/**
 * Get or create the auth container in the nav. Call from renderNav.
 * @param {HTMLElement} navContainer - The #pageNav container
 * @returns {HTMLElement|null}
 */
export function getOrCreateAuthSlot(navContainer) {
  if (!navContainer) return null;
  let slot = document.getElementById(AUTH_UI_CONTAINER_ID);
  if (!slot) {
    slot = document.createElement("div");
    slot.id = AUTH_UI_CONTAINER_ID;
    slot.className = "auth-ui";
    slot.setAttribute("aria-live", "polite");
    navContainer.appendChild(slot);
  }
  return slot;
}
