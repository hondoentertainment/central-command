# Roadmap

## Completed

- **Production UX polish pass** — Shared tokens normalized, consistent panel/header rhythm, neutral component naming (`content-link-block`, `panel__intro-text`), and low-risk a11y semantics (`aria-current`, `aria-pressed`, dialog metadata, 44px touch targets).
- **Bulk actions** — Multi-select on the command deck: bulk pin/unpin, change category, export selection, delete; confirmation copy and aria-live for screen readers.
- **Accessibility polish** — Skip link, focus trap in Layout and Quick Add modals, Escape to close, aria-live announcements for select mode and batch actions, aria-modal on dialogs.
- **Import from URL** — `?import=URL` query loads backup from remote JSON (see README).
- **Design tokens** — Single `:root` and `html.theme-light`; sidebar and focus use tokens; `--btn-on-primary`, `--focus-ring`; contrast tweak for secondary text.
- **Performance** — Runbook and history lazy by route (separate pages, own scripts). Tool grid virtualized when ≥50 tools; resize/layout recalc cols and totalRows. Non-critical scripts deferred; critical path on Command: app.js and sw-register.js.
- **Sharing & export (UI)** — “Import from URL…” and “Copy backup to clipboard” in Command More menu; backup JSON includes tools, notes, launch history.
- **More integrations** — Google Docs and Google Drive in Full Command preset; Layout panel hint: “Add Calendar, Docs, and more from Starter Packs.”
- **Music** — Music page: Rolling Stone 500, AllMusic, and Pitchfork link blocks; meta and header copy updated.

## Recently Completed

- **Sharing & export (advanced)** — Shareable deck links (base64 encoded URL), scheduled exports (daily/weekly/monthly auto-download), and in-app “Import from URL” modal dialog replacing the browser prompt.
- **Browse nav grouping** — Sidebar browse section grouped into collapsible Work, Play, and Media categories for reduced cognitive load.
- **Empty category page hints** — Contextual per-category hints with links to relevant starter packs and the tool registry when a category page is empty.
- **Integration settings panel** — Dedicated Integrations section on the Settings page for managing Creative Hub and future integrations (URL, visibility, open mode).
- **Integration reliability** — URL health checks for integration endpoints, friendly fallback messages, and unit tests for health-check logic.
- **Test coverage expansion** — New unit tests for hooks, surfaces-settings, and integration health check modules.
- **Multi-integration framework** — Generalized integrations registry with first-class Notion, Linear, and Google Calendar alongside Creative Hub. Nav, command palette, and tool deck surface each enabled integration; settings page renders all entries dynamically.
- **Sync status indicator** — Small nav badge reflects syncing / synced / offline / error state, with an inline Retry action when a cloud write fails. Concurrent operations coalesce; online/offline events flip state automatically.
- **Task depth** — Browser notification reminders for tasks due today (opt-in, once-per-day per task) and keyboard shortcuts on the Tasks page (`N` new, `T` today, `I` inbox, `A` all).
- **Sync indicator bootstrap** — Nav mount now emits a "Connecting to cloud…" sync signal for returning signed-in users so the indicator is not blank while the first read fires.
- **Integration adoption telemetry** — Admin page shows per-integration open counts, share-of-total, last-opened time, and last-open source. Clear-log action wipes the local event store.
- **Background task reminders** — Tasks page persists a due-today IndexedDB snapshot; the service worker handles `periodicsync` (6-hour min interval) and `notificationclick` to fire and route reminders even when no tab is open. Falls back gracefully on browsers without periodic background sync.

## Next

- **Sync data types** — Extend Firestore sync to cover tasks, projects, and knowledge-base entries (currently only tools/notes/history sync).
- **Integration health dashboard** — Surface repeated failed launches per integration alongside the telemetry table.
