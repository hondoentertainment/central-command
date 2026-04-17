const CACHE_VERSION = 8;
const CACHE_NAME = `central-command-v${CACHE_VERSION}`;

const REMINDER_DB_NAME = "central-command.reminders";
const REMINDER_DB_VERSION = 1;
const REMINDER_STORE = "snapshots";
const REMINDER_KEY = "due-today";
const REMINDER_SYNC_TAG = "central-command.task-reminders";

const BASE = location.pathname.includes("/central-command") ? "/central-command" : "";

const REWRITE_MAP = {
  "/registry": "/registry.html",
  "/agents": "/agents.html",
  "/packs": "/packs.html",
  "/sports": "/sports.html",
  "/games": "/games.html",
  "/health": "/health.html",
  "/music": "/music.html",
  "/movies": "/movies.html",
  "/parties": "/parties.html",
  "/admin": "/admin.html",
  "/writing": "/writing.html",
  "/productivity": "/productivity.html",
  "/history": "/history.html",
  "/runbook": "/runbook.html",
  "/profile": "/profile.html",
  "/settings": "/settings.html",
  "/projects": "/projects.html",
  "/tasks": "/tasks.html",
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
  BASE + "/health.html",
  BASE + "/music.html",
  BASE + "/movies.html",
  BASE + "/parties.html",
  BASE + "/admin.html",
  BASE + "/writing.html",
  BASE + "/productivity.html",
  BASE + "/history.html",
  BASE + "/runbook.html",
  BASE + "/profile.html",
  BASE + "/settings.html",
  BASE + "/projects.html",
  BASE + "/tasks.html",
  BASE + "/app-tasks.js",
  BASE + "/lib/tasks.js",
  BASE + "/lib/task-reminders.js",
  BASE + "/lib/reminder-store.js",
  BASE + "/lib/sync-status.js",
  BASE + "/lib/sync-indicator.js",
  BASE + "/lib/workspaces.js",
  BASE + "/styles.css",
  BASE + "/manifest.json",
  BASE + "/app.js",
  BASE + "/app-registry.js",
  BASE + "/app-agents.js",
  BASE + "/app-packs.js",
  BASE + "/app-sports.js",
  BASE + "/app-games.js",
  BASE + "/app-health.js",
  BASE + "/app-music.js",
  BASE + "/app-movies.js",
  BASE + "/app-parties.js",
  BASE + "/app-admin.js",
  BASE + "/app-writing.js",
  BASE + "/app-productivity.js",
  BASE + "/app-history.js",
  BASE + "/app-runbook.js",
  BASE + "/app-profile.js",
  BASE + "/app-settings.js",
  BASE + "/app-projects.js",
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

function openReminderDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable in this worker"));
      return;
    }
    const req = indexedDB.open(REMINDER_DB_NAME, REMINDER_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(REMINDER_STORE)) {
        db.createObjectStore(REMINDER_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readSnapshot(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REMINDER_STORE, "readonly");
    const store = tx.objectStore(REMINDER_STORE);
    const req = store.get(REMINDER_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function writeSnapshot(db, snapshot) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REMINDER_STORE, "readwrite");
    const store = tx.objectStore(REMINDER_STORE);
    store.put(snapshot, REMINDER_KEY);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

function todayIso() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

async function announceDueTodayFromSnapshot() {
  if (!self.registration?.showNotification) return 0;

  let db;
  try {
    db = await openReminderDb();
  } catch {
    return 0;
  }

  let snapshot;
  try {
    snapshot = await readSnapshot(db);
  } catch {
    db.close();
    return 0;
  }

  if (!snapshot || !Array.isArray(snapshot.tasks) || snapshot.tasks.length === 0) {
    db.close();
    return 0;
  }

  const today = todayIso();
  if (snapshot.date !== today) {
    db.close();
    return 0;
  }

  const reminded = Array.isArray(snapshot.remindedIds) ? snapshot.remindedIds : [];
  const remindedSet = new Set(reminded);
  const pending = snapshot.tasks.filter((task) => task.id && !remindedSet.has(task.id));
  if (pending.length === 0) {
    db.close();
    return 0;
  }

  const newlyReminded = [];
  for (const task of pending) {
    try {
      await self.registration.showNotification(`Task due today: ${task.title}`, {
        body: task.notes || "Open Central Command to complete this task.",
        tag: `cc-task-${task.id}`,
        silent: task.priority === "low",
        data: { url: "./tasks.html", taskId: task.id },
      });
      newlyReminded.push(task.id);
    } catch {
      // ignore individual failures
    }
  }

  if (newlyReminded.length > 0) {
    try {
      await writeSnapshot(db, {
        ...snapshot,
        remindedIds: [...reminded, ...newlyReminded],
      });
    } catch {
      // ignore
    }
  }

  db.close();
  return newlyReminded.length;
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== REMINDER_SYNC_TAG) return;
  event.waitUntil(announceDueTodayFromSnapshot());
});

self.addEventListener("sync", (event) => {
  if (event.tag !== REMINDER_SYNC_TAG) return;
  event.waitUntil(announceDueTodayFromSnapshot());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "central-command:trigger-reminder-check") {
    event.waitUntil(announceDueTodayFromSnapshot());
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./tasks.html";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })()
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
