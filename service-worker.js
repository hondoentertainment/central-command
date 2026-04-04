const CACHE_VERSION = 2;
const CACHE_NAME = `central-command-v${CACHE_VERSION}`;

const BASE = location.pathname.includes("/central-command") ? "/central-command" : "";

const REWRITE_MAP = {
  "/registry": "/registry.html",
  "/agents": "/agents.html",
  "/packs": "/packs.html",
  "/sports": "/sports.html",
  "/games": "/games.html",
  "/writing": "/writing.html",
  "/productivity": "/productivity.html",
  "/history": "/history.html",
  "/runbook": "/runbook.html",
};

const REWRITES = {};
for (const [k, v] of Object.entries(REWRITE_MAP)) {
  REWRITES[BASE + k] = BASE + v;
}

const PRECACHE = [
  BASE + "/",
  BASE + "/index.html",
  BASE + "/registry.html",
  BASE + "/agents.html",
  BASE + "/packs.html",
  BASE + "/sports.html",
  BASE + "/games.html",
  BASE + "/writing.html",
  BASE + "/productivity.html",
  BASE + "/history.html",
  BASE + "/runbook.html",
  BASE + "/styles.css",
  BASE + "/manifest.json",
  BASE + "/app.js",
  BASE + "/app-registry.js",
  BASE + "/app-agents.js",
  BASE + "/app-packs.js",
  BASE + "/app-sports.js",
  BASE + "/app-games.js",
  BASE + "/app-writing.js",
  BASE + "/app-productivity.js",
  BASE + "/app-history.js",
  BASE + "/app-runbook.js",
  BASE + "/lib/nav.js",
  BASE + "/lib/icons.js",
  BASE + "/lib/storage.js",
  BASE + "/lib/tool-model.js",
  BASE + "/lib/debounce.js",
  BASE + "/lib/keyboard-shortcuts.js",
  BASE + "/lib/batch-actions.js",
  BASE + "/lib/surfaces-settings.js",
  BASE + "/lib/toast.js",
  BASE + "/lib/integrations.js",
  BASE + "/lib/command-palette.js",
  BASE + "/lib/theme.js",
  BASE + "/lib/auth-ui.js",
  BASE + "/data/presets.js",
  BASE + "/icons/icon-192.svg",
  BASE + "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const path = url.pathname;
  const isRoot = path === "/" || path === BASE || path === BASE + "/";
  const isStatic =
    /\.(html?|css|js|json|svg|png|ico|woff2?)$/i.test(path) ||
    isRoot ||
    path in REWRITES ||
    path.startsWith(BASE + "/lib/") ||
    path.startsWith(BASE + "/data/") ||
    path.startsWith(BASE + "/icons/");

  if (!isStatic) return;

  const altRequest = REWRITES[path] ? new Request(new URL(REWRITES[path], url.origin)) : null;

  const isCodeAsset = /\.(js|css)$/i.test(path);

  if (isCodeAsset) {
    // Network-first for JS/CSS: ensures fresh code after deploys
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || new Response("Offline", { status: 503 })))
    );
  } else {
    // Cache-first for HTML, images, fonts, etc.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (altRequest) return caches.match(altRequest);
        return fetch(event.request).then((response) => {
          if (!response.ok) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
