if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").then((registration) => {
    // Dynamically import the update-UX module so it doesn't block page load
    import("./lib/sw-update.js").then(({ listenForSwUpdate }) => {
      listenForSwUpdate(registration);
    }).catch(() => { /* non-critical */ });
  }).catch(console.error);
}
