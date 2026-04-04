# Central Command — Architecture

## Overview

Central Command is a personal productivity hub built as a static PWA with optional Firebase cloud sync. It centralizes tool launchers, daily notes, and operational workflows into a single dashboard.

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES modules, no build step)
- **Styling**: Single `styles.css` with CSS custom properties for theming
- **Persistence**: localStorage (primary) + Firebase Firestore (optional cloud sync)
- **PWA**: Service worker with network-first (JS/CSS) and cache-first (assets) strategies
- **Auth**: Firebase Anonymous or Email/Password authentication
- **Deployment**: GitHub Pages + Vercel (static hosting)

## Module Dependency Graph

```
index.html / registry.html / runbook.html / ...
    │
    ├── app.js / app-registry.js / app-runbook.js / ...  (page controllers)
    │       │
    │       ├── lib/keyboard-shortcuts.js   (Ctrl+key tool launching)
    │       ├── lib/batch-actions.js        (select mode, bulk operations)
    │       ├── lib/surfaces-settings.js    (hero/spotlight/integration config)
    │       │
    │       ├── lib/tool-model.js     (data sanitization, sorting, history)
    │       ├── lib/storage.js        (localStorage + Firestore sync layer)
    │       │       └── lib/firebase.js   (SDK init, auth, CRUD, merge)
    │       │
    │       ├── lib/nav.js            (page navigation, mobile hamburger)
    │       │       ├── lib/auth-ui.js        (sign-in/out UI)
    │       │       ├── lib/command-palette.js (Cmd+K global search)
    │       │       ├── lib/theme.js          (light/dark toggle)
    │       │       └── lib/integrations.js   (Creative Hub config)
    │       │
    │       ├── lib/icons.js          (SVG icon registry)
    │       ├── lib/toast.js          (notification toasts with actions)
    │       ├── lib/debounce.js       (timing utility)
    │       └── data/presets.js       (default tools, categories, packs)
```

## Data Flow

### State Management

Each page has its own `state` object (not shared across pages). State is mutated directly and triggers a `render()` function that re-builds the DOM.

```
User Action → Event Handler → Mutate state → render() → DOM update
                                    │
                                    └── save*Synced() → localStorage + Firestore
```

### Sync Strategy

1. **Offline-first**: All writes go to localStorage immediately
2. **Cloud sync**: If signed in, writes are also sent to Firestore
3. **Merge**: On sign-in, `performInitialSync()` merges local and cloud data using last-write-wins by `updatedAt` timestamps
4. **Debounced writes**: Runbook auto-save is debounced (800ms) to prevent Firestore write amplification
5. **Error recovery**: Sync failures show toast notifications with retry buttons

### Data Models

**Tool** (see `lib/tool-model.js`):
```
{ id, name, url, category, description, accent, pinned, pinRank,
  surfaces[], iconKey, iconUrl?, shortcutLabel, openMode, updatedAt? }
```

**Launch History Entry**:
```
{ toolId, launchedAt (ISO string), count }
```

## Security

- **XSS Protection**: Runbook markdown preview sanitizes HTML through an allowlist-based sanitizer before rendering
- **Input Validation**: All tool data passes through `sanitizeTool()` which validates, trims, and normalizes fields
- **Import Validation**: JSON imports are checked for file size (5MB max), structure, and tool count (500 max)
- **URL Safety**: `isValidLaunchTarget()` validates URLs against known-safe patterns

## Testing

- **Unit tests** (`tests/`): Node.js assert-based tests for core utilities — run with `npm test`
- **E2E tests** (`e2e/`): Playwright browser tests for critical user flows — run with `npm run test:e2e`
- **Linting**: ESLint with Prettier integration — run with `npm run lint`

## Key Design Decisions

1. **No build step**: Files are served as-is. This keeps the project simple and deployable anywhere
2. **No framework**: Vanilla JS with manual DOM manipulation. Keeps bundle at zero and load instant
3. **Firebase as optional**: App works fully offline without Firebase configured
4. **Service worker network-first for code**: JS/CSS use network-first strategy to prevent stale code after deploys, while HTML/images use cache-first for speed
