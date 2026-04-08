/**
 * Service-worker update UX.
 * Detects a waiting service worker and shows a toast prompting the user to
 * reload. On confirmation it tells the waiting SW to skip waiting, then
 * reloads the page once the new controller takes over.
 */
import { showToast } from "./toast.js";

/**
 * Call once after the page has loaded (e.g. from app.js or sw-register.js).
 * @param {ServiceWorkerRegistration} registration
 */
export function listenForSwUpdate(registration) {
  if (!registration) return;

  // If a SW is already waiting when we run, prompt immediately
  if (registration.waiting) {
    promptUpdate(registration.waiting);
    return;
  }

  // A new SW has just finished installing
  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      // "installed" with an existing controller means an update is ready
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        promptUpdate(newWorker);
      }
    });
  });
}

function promptUpdate(waitingWorker) {
  showToast("Update available \u2014 click to refresh", "info", {
    actionLabel: "Refresh",
    duration: 0, // stay visible until dismissed
    onAction: () => {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    },
  });

  // Once the new SW activates, reload
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}
