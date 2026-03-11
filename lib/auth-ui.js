/**
 * Auth UI: Sign in / Sync button and signed-in state.
 * Renders in nav or hero. Uses Firebase Anonymous Auth by default.
 */

import {
  initFirebase,
  isFirebaseConfigured,
  onAuthStateChanged,
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
      signedIn.textContent = "Signed in";

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
      const signInBtn = document.createElement("button");
      signInBtn.type = "button";
      signInBtn.className = "auth-ui__sign-in ghost-button";
      signInBtn.textContent = "Sign in";
      signInBtn.setAttribute("aria-label", "Sign in to sync across devices");
      signInBtn.addEventListener("click", async () => {
        signInBtn.disabled = true;
        signInBtn.textContent = "Signing in…";
        try {
          await signInAnonymously();
        } catch (err) {
          console.warn("Sign in failed:", err?.message);
          signInBtn.textContent = "Sign in";
        } finally {
          signInBtn.disabled = false;
        }
      });

      container.append(signInBtn);
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
