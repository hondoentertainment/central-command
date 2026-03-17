# Roadmap

## Completed

- **Bulk actions** — Multi-select on the command deck: bulk pin/unpin, change category, export selection, delete; confirmation copy and aria-live for screen readers.
- **Accessibility polish** — Skip link, focus trap in Layout and Quick Add modals, Escape to close, aria-live announcements for select mode and batch actions, aria-modal on dialogs.
- **Import from URL** — `?import=URL` query loads backup from remote JSON (see README).
- **Design tokens** — Single `:root` and `html.theme-light`; sidebar and focus use tokens; `--btn-on-primary`, `--focus-ring`; contrast tweak for secondary text.
- **Performance** — Runbook and history lazy by route (separate pages, own scripts). Tool grid virtualized when ≥50 tools; resize/layout recalc cols and totalRows. Non-critical scripts deferred; critical path on Command: app.js and sw-register.js.
- **Sharing & export (UI)** — “Import from URL…” and “Copy backup to clipboard” in Command More menu; backup JSON includes tools, notes, launch history.
- **More integrations** — Google Docs and Google Drive in Full Command preset; Layout panel hint: “Add Calendar, Docs, and more from Starter Packs.”
- **Music** — Music page: Rolling Stone 500, AllMusic, and Pitchfork link blocks; meta and header copy updated.

## Next

- **Sharing & export (advanced)** — Share a read-only or copyable deck link; scheduled exports; optional in-app “Import from URL” dialog (beyond prompt).
- **More integrations** — Additional linkable services (e.g. dashboards, Notion) and optional Creative Hub–style quick actions.
