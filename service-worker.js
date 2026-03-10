const CACHE_NAME = "central-command-v1";

const REWRITES = { "/registry": "/registry.html", "/agents": "/agents.html", "/packs": "/packs.html", "/sports": "/sports.html", "/games": "/games.html", "/writing": "/writing.html", "/productivity": "/productivity.html", "/history": "/history.html", "/runbook": "/runbook.html" };

const PRECACHE = [
  "/",
  "/index.html",
  "/registry.html",
  "/agents.html",
  "/packs.html",
  "/sports.html",
  "/games.html",
  "/writing.html",
  "/productivity.html",
  "/history.html",
  "/runbook.html",
  "/styles.css",
  "/manifest.json",
  "/app.js",
  "/app-registry.js",
  "/app-agents.js",
  "/app-packs.js",
  "/app-sports.js",
  "/app-games.js",
  "/app-writing.js",
  "/app-productivity.js",
  "/app-history.js",
  "/app-runbook.js",
  "/lib/nav.js",
  "/lib/icons.js",
  "/lib/storage.js",
  "/lib/tool-model.js",
  "/data/presets.js",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
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

  const isStatic =
    /\.(html?|css|js|json|svg|png|ico|woff2?)$/i.test(url.pathname) ||
    url.pathname === "/" ||
    url.pathname in REWRITES ||
    url.pathname.startsWith("/lib/") ||
    url.pathname.startsWith("/data/") ||
    url.pathname.startsWith("/icons/");

  if (!isStatic) return;

  const altRequest = REWRITES[url.pathname] ? new Request(new URL(REWRITES[url.pathname], url.origin)) : null;

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
});
