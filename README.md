# Central Command

**One place for the tools you reach for most.** A personal link launcher and operations hub.

## What It Does

Central Command keeps tools (URLs, local paths, app protocols), quick links, preset packs, launch history, and daily runbook notes in one place. Launch faster, organize by workflow, and keep the day moving.

## Features

- **Command deck** — Full grid with search, category filters, and pinned tools
- **Tool Registry** — Add, edit, and manage tools with custom URLs, icons, and shortcuts
- **Category pages** — Sports, Games, Writing, Productivity, Agents, Music (Rolling Stone 500 → Spotify), and more
- **Starter packs** — Apply preset packs to quickly populate your deck
- **Recent history** — Track recent launches for quick re-access
- **Runbook** — Daily notes and runbook-style text stored locally
- **PWA** — Installable; add to home screen and use offline
- **Keyboard shortcuts** — Ctrl+letter for pinned tools (e.g. Ctrl+G, Ctrl+S)

## Automatic Backup Loading

- **`backup.json`** — Place a `backup.json` file in the project root (same format as Export backup). On first visit when storage is empty, the app auto-loads it. Add the file and deploy.
- **`?import=URL`** — Add `?import=https://example.com/backup.json` to the URL to fetch and import from a remote JSON file. Clears the query after import.

## Running Locally

Static site — use any HTTP server. For parity with **Vercel extensionless URLs** (`/music`, `/registry`, …), use the bundled config:

```bash
npm run dev
# same as: npx serve . -p 3000  (loads serve.json from the project root)
```

`serve.json` defines rewrites that mirror `vercel.json`. Plain `python -m http.server` only serves `*.html` paths unless you add your own routing.

**Note:** Save `serve.json` as UTF-8 **without BOM**. A BOM breaks the `serve` CLI JSON parser.

### Cross-Device Sync (Firebase)

To enable cloud sync across devices:

1. Copy `config/firebase.config.example.js` to `firebase.config.local.js` (in project root) or `config/firebase.config.local.js`
2. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
3. Add a web app and copy the config values into `firebase.config.local.js`
4. Enable **Anonymous Auth** (or Email/Password) in Firebase Authentication
5. Create a Firestore database
6. Set Firestore rules so users can read/write only their own data. See `firestore.rules.example` (one document per user at `users/{userId}`):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Data (tools, notes, launch history) syncs to `users/{uid}/` in Firestore. **Offline persistence** is enabled: writes go to the local cache when offline and sync automatically when back online. Do not commit `firebase.config.local.js` (it is gitignored).

**Deploy with Firebase from env**: Set these env vars in Vercel (Project → Settings → Environment Variables) or GitHub Actions secrets: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`. Run `node scripts/build-firebase-config.js` before deploy to generate `config/firebase.config.generated.js`. The loader tries generated first, then local. Vercel runs the script via `buildCommand`; GitHub Actions runs it in the deploy workflow.

## Install as PWA

Visit the deployed site and use your browser's **Add to home screen** (or **Install app**) option. Available when visiting the production URL.

## Production

**URLs:** [GitHub Pages](https://hondoentertainment.github.io/central-command/) · [Vercel](https://central-command-self.vercel.app/)

Deploys to GitHub Pages (on push to `master`) and Vercel. On **Vercel**, `vercel.json` rewrites map extensionless paths to the matching `*.html` files (same rules as local `serve.json`).

### Deploy on push (Vercel)

To have every push to `master` update the live Vercel site automatically:

1. In [Vercel Dashboard](https://vercel.com) → your project → **Settings** → **Git**
2. Ensure the GitHub repo is connected and **Production Branch** is set to `master`
3. Pushes to `master` will trigger a production deploy; other branches get preview URLs

## Tech

- **Vanilla JS**, ES modules, no framework
- Static HTML/CSS/JS; no app bundler or compile step
- Optional **deploy-time** script: `node scripts/build-firebase-config.js` emits `config/firebase.config.generated.js` from environment variables (used by Vercel `buildCommand` and the GitHub Pages workflow)
- Deploys as a static site to GitHub Pages and Vercel

## Tests & CI

- **Unit tests:** `npm test` (runs `tests/*.test.js` with Node).
- **E2E tests:** `npm run test:e2e` (Playwright; starts a static server automatically).

On every push and pull request to `main`/`master`, the **CI** workflow runs both unit and E2E tests (see `.github/workflows/ci.yml`). Deploy workflows (GitHub Pages, Vercel) run after you push.

## E2E Tests

Playwright E2E tests live in `e2e/`. Run:

```bash
npm run test:e2e
```

For debugging with the UI:

```bash
npm run test:e2e:ui
```

Tests start a static server (`npx serve . -p 3000`) automatically. Ensure port 3000 is free, or run `npm run dev` first — Playwright will reuse an existing server. Fixture data is in `e2e/fixtures/sample-backup.json`.

## Project Structure

| Path | Purpose |
|------|---------|
| `app.js` | Main entry, state, render loop, event handlers |
| `index.html` | Shell, hero, spotlight, command deck |
| `lib/` | `tool-model.js`, `storage.js`, `icons.js`, `nav.js`, `category-hub-page.js` |
| `serve.json` | Local static-server rewrites (aligned with `vercel.json`) |
| `data/presets.js` | Preset packs, category options, tool factory |
| `*.html` | Category pages (sports, games, writing, music, etc.) |
| `manifest.json` | PWA manifest |
