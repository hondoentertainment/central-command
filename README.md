# Central Command

**One place for the tools you reach for most.** A personal link launcher and operations hub.

## What It Does

Central Command keeps tools (URLs, local paths, app protocols), quick links, preset packs, launch history, and daily runbook notes in one place. Launch faster, organize by workflow, and keep the day moving.

## Features

- **Command deck** — Full grid with search, category filters, and pinned tools
- **Tool Registry** — Add, edit, and manage tools with custom URLs, icons, and shortcuts
- **Category pages** — Sports, Games, Writing, Productivity, Agents, and more
- **Starter packs** — Apply preset packs to quickly populate your deck
- **Recent history** — Track recent launches for quick re-access
- **Runbook** — Daily notes and runbook-style text stored locally
- **PWA** — Installable; add to home screen and use offline
- **Keyboard shortcuts** — Ctrl+letter for pinned tools (e.g. Ctrl+G, Ctrl+S)

## Running Locally

Static site — use any HTTP server:

```bash
npx serve .
# or
python -m http.server 8000
```

### Cross-Device Sync (Firebase)

To enable cloud sync across devices:

1. Copy `config/firebase.config.example.js` to `firebase.config.local.js` (in project root) or `config/firebase.config.local.js`
2. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
3. Add a web app and copy the config values into `firebase.config.local.js`
4. Enable **Anonymous Auth** (or Email/Password) in Firebase Authentication
5. Create a Firestore database
6. Set Firestore rules so users can read/write only their own data, e.g.:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Data (tools, notes, launch history) syncs to `users/{uid}/` in Firestore. **Offline persistence** is enabled: writes go to the local cache when offline and sync automatically when back online. Do not commit `firebase.config.local.js` (it is gitignored).

## Install as PWA

Visit the deployed site and use your browser's **Add to home screen** (or **Install app**) option. Available when visiting the production URL.

## Production

**URL:** https://hondoentertainment.github.io/central-command/

Deploys to GitHub Pages and Vercel.

## Tech

- **Vanilla JS**, ES modules, no framework
- Static HTML/CSS/JS; no build step
- Deploys as a static site to GitHub Pages and Vercel

## Project Structure

| Path | Purpose |
|------|---------|
| `app.js` | Main entry, state, render loop, event handlers |
| `index.html` | Shell, hero, spotlight, command deck |
| `lib/` | `tool-model.js`, `storage.js`, `icons.js`, `nav.js` |
| `data/presets.js` | Preset packs, category options, tool factory |
| `*.html` | Category pages (sports, games, writing, etc.) |
| `manifest.json` | PWA manifest |
