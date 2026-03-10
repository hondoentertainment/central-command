---
name: central-command-overview
description: Understand Central Command structure, tool model, storage, and conventions. Use when working on Central Command, onboarding to the codebase, or making structural changes to the app.
---

# Central Command Overview

## What It Is

Central Command is a personal link launcher / operations hub. It keeps tools (URLs or local paths), quick links, preset packs, launch history, and daily notes in one place. Vanilla JS with ES modules; no framework. Deploys as a static site on Vercel.

## Project Structure

```
app.js          # Main entry, state, render loop, event handlers
index.html      # Shell, hero, spotlight, tab panels, form, template
styles.css      # Layout and visuals
data/presets.js # PRESET_PACKS, DEFAULT_TOOLS, CATEGORY_OPTIONS, createTool()
lib/tool-model.js # Tool schema, sanitization, sorting, launch history, URL validation
lib/storage.js  # localStorage keys, load/save for tools, notes, launch history
lib/icons.js    # ICON_OPTIONS, appIcons, getIconMarkup()
```

## Tool Model

Every tool has:

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID, required |
| name | string | Required |
| url | string | URL, file path, or app protocol (e.g. `steam://`) |
| category | string | Required |
| description | string | Required |
| accent | enum | `amber`, `teal`, `crimson`, `cobalt` |
| pinned | boolean | Pin to top of deck |
| pinRank | number \| null | Order when pinned (1-based) |
| surfaces | string[] | `hero`, `spotlight` — where tool is shown |
| iconKey | string | From `lib/icons.js` ICON_OPTIONS, or `auto` |
| shortcutLabel | string | Max 16 chars, e.g. "Ctrl+1" |
| openMode | enum | `new-tab`, `same-tab` |

Validation lives in `tool-model.js`: `sanitizeTool`, `isValidLaunchTarget`, `normalizeUrl`. Use these for any new tool input.

## Storage Keys

From `lib/storage.js`:

- `central-command.tools.v2` — current tools
- `central-command.notes.v1` — daily runbook text
- `central-command.launch-history.v1` — recent launches

Legacy tools keys (`central-command.tools.v1` etc.) are checked and migrated when loading. Add new keys as versioned (e.g. `.v2`) and keep legacy keys in `legacyTools` for migration.

## Surfaces

- **Hero**: Top quick links; users pick which tools appear here via "Show in hero".
- **Spotlight**: Grid of core tools below hero.
- **Command deck**: Full grid with search and category filters.

## State Flow

- State lives in `state` in `app.js`.
- `render()` updates hero, spotlight, filters, cards, history, status.
- Persistence: `saveStoredTools`, `saveLaunchHistory`, `saveNotes` write to localStorage.
- Preset apply and import use `hydrateTools` with fallback metadata from presets.

## Conventions

- Use `structuredClone()` when copying tool arrays (avoids mutating stored data).
- Export version in backups is `EXPORT_VERSION` in app.js; bump when changing backup format.
- Icon keys must be in `ICON_OPTIONS`; add new icons in `lib/icons.js` before using in presets.
- Categories: use `CATEGORY_OPTIONS` from presets.js for consistency; custom categories are allowed.
