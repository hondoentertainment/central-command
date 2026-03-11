---
name: vanilla-js-dashboard
description: Build and maintain vanilla JS dashboard and link-launcher apps without a framework. Use when working on state management, DOM rendering, localStorage persistence, or adding features to framework-free SPAs.
---

# Vanilla JS Dashboard Patterns

## Context

Central Command and similar link launchers use vanilla JS with ES modules. No React, Vue, or Vite. Static HTML/CSS/JS served directly or via a simple static host (e.g. Vercel).

## State Management

- Keep a single `state` object at module scope.
- Treat state as immutable when persisting: use `structuredClone()` before storing.
- Avoid duplicating derived data; compute on read or in render.

```javascript
const state = {
  tools: [],
  query: "",
  activeCategory: "All",
  // ...
};
```

## DOM Rendering Pattern

1. **Clear container** — `container.innerHTML = ""` or replace children.
2. **Build fragments** — Use `DocumentFragment` or `template.content.cloneNode(true)` for repeated structures.
3. **Bind events in the loop** — Add listeners when creating nodes; avoid delegation if it obscures flow.
4. **Use ARIA** — `aria-live` for dynamic regions, `aria-label` for links/buttons.

```javascript
function renderCards() {
  elements.toolGrid.innerHTML = "";
  visibleTools.forEach((tool) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".tool-card");
    // ... populate, bind events
    elements.toolGrid.appendChild(fragment);
  });
}
```

## localStorage Persistence

- Use versioned keys: `app-name.entity.v1`.
- Support legacy migration: check old keys, transform, write to new key.
- Handle parse errors: `try/catch` around `JSON.parse`, fall back to defaults.

```javascript
function loadStoredTools(hydrate, fallback) {
  const raw = localStorage.getItem(STORAGE_KEYS.tools);
  if (!raw) return structuredClone(fallback);
  try {
    const parsed = JSON.parse(raw);
    const hydrated = hydrate(parsed);
    return hydrated.length > 0 ? hydrated : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}
```

## Event Handling

- Attach listeners once in `initialize()`, not in every render.
- Use delegated handlers only when list items change often and listeners would be duplicated.
- For forms: `form.addEventListener("submit", handleSubmit)` and `event.preventDefault()`.

## Import/Export and Backup

- Export JSON with version, timestamp, and entities.
- Import: parse, validate, hydrate (fill missing fields from presets), then replace state and persist.
- Keep export schema backward-compatible; ignore unknown fields when importing.

## Static Deployment

- No build step required for plain JS. Vercel `outputDirectory: "."` serves the repo root.
- Use ES modules: `<script type="module" src="./app.js"></script>`.
- Relative imports: `import { X } from "./lib/storage.js"` — extensions required in browser.

## Conventions for This Codebase

- Render functions are named `render*` (e.g. `renderCards`, `renderFilters`).
- Main `render()` orchestrates all sub-renders; call it after any state change that affects the UI.
- Use `elements` object to cache `querySelector` results and avoid repeated DOM lookups.
