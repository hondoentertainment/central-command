# Central Command — Feature Roadmap

**Last updated:** March 2025  
**Current phase:** All 5 phases implemented

---

## Completed (Pre-roadmap)

- Command deck with search, filters, pinned tools
- Tool Registry (add, edit, import/export)
- Category pages (Sports, Games, Writing, Productivity, Agents)
- Starter packs
- Recent history with filtering
- Runbook with markdown preview
- PWA (installable, offline)
- Keyboard shortcuts (Ctrl+letter for pinned tools)
- Arrow-key navigation in tool grid
- Responsive nav (hamburger on mobile)
- SEO (robots.txt, sitemap.xml)
- Deploy to GitHub Pages + Vercel

---

## Phase 1: Polish & UX — *~1 week* ✅ **DONE**

**Goal:** Refine core experience and accessibility.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Theme toggle** | Light/dark mode switch; persist in localStorage | 2–3 hrs |
| **Loading states** | Skeleton or spinner for grid, history, registry form | 2 hrs |
| **Empty states** | Clear CTAs when deck/history/runbook is empty | 1 hr |
| **Focus trap in modals** | Registry form modal (if applicable) keeps focus within | 1 hr |
| **Runbook versioning** | Optional "last edited" timestamp or simple history | 2 hrs |

**Outcome:** Feels more polished; fewer edge cases.

---

## Phase 2: Cross-Device Sync — *~2 weeks* ✅ **DONE**

**Goal:** Use Central Command on multiple devices.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Cloud backup** | Optional Firebase or Supabase; sync tools, notes, history | 3–5 days |
| **Sign-in** | Minimal auth (email or anonymous); link data to account | 2 days |
| **Conflict resolution** | Last-write-wins or manual merge for conflicts | 1–2 days |
| **Offline queue** | Queue changes when offline; sync when back | 1–2 days |

**Outcome:** Tools and runbook available from any device.

---

## Phase 3: Power User — *~1.5 weeks* ✅ **DONE**

**Goal:** Faster workflows for heavy users.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Global search** | Search across tools + runbook from any page; Cmd+K style | 2–3 days |
| **Quick add** | Inline "Add tool" from Command deck; minimal form | 1 day |
| **Batch actions** | Select multiple tools; bulk pin, delete, change category | 2 days |
| **Runbook templates** | Save runbook snippets as templates (e.g. "Daily standup") | 1–2 days |
| **More shortcut slots** | Extend beyond single letter (e.g. Ctrl+Shift+G) | 1 day |

**Outcome:** Less friction for frequent actions.

---

## Phase 4: Extensibility — *~2 weeks* ✅ **DONE**

**Goal:** Let users customize without forking.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Custom categories** | Create and manage categories beyond presets | 1 day |
| **Custom icons** | Upload or URL for tool icons | 1–2 days |
| **Layout preferences** | Grid vs list; compact vs spacious | 1 day |
| **Per-page settings** | Toggle which surfaces show on Command vs category pages | 2 days |
| **Webhooks / integrations** | Optional: trigger on launch (e.g. analytics, logging) | 2–3 days |

**Outcome:** Central Command adapts to individual workflows.

---

## Phase 5: Scale & Reliability — *~1.5 weeks* ✅ **DONE**

**Goal:** Handle more tools and usage safely.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Virtualization** | Virtualize tool grid for 100+ tools | 2 days |
| **Performance audit** | Profile render, storage, and lazy-load as needed | 1 day |
| **Automated tests** | Unit tests for tool-model, storage; E2E for critical flows | 2–3 days |
| **Error boundaries** | Graceful fallback if localStorage fails or quota exceeded | 1 day |
| **Analytics (optional)** | Anonymous usage metrics if desired | 1 day |

**Outcome:** Stable and fast at higher usage.

---

## Summary (Phases 1–5)

| Phase | Focus | Timeline |
|-------|-------|----------|
| 1 | Polish & UX | ~1 week |
| 2 | Cross-device sync | ~2 weeks |
| 3 | Power user | ~1.5 weeks |
| 4 | Extensibility | ~2 weeks |
| 5 | Scale & reliability | ~1.5 weeks |

**Total:** ~8 weeks of focused work — all complete.

---

## Phases 6–15: Next Evolution

With the core product stable and the Creative Hub integration shipped, the next 10 phases expand Central Command from a personal link launcher into a full **personal operations platform**. Each phase builds on the previous and can be adjusted based on user feedback.

---

## Phase 6: Workspaces & Contexts — *~2 weeks*

**Goal:** Let users switch between different tool configurations based on context (work, personal, project-specific).

| Feature | Description | Effort |
|---------|-------------|--------|
| **Workspace switcher** | Create named workspaces (e.g. "Day Job", "Side Project", "Personal"); each has its own tool set, pinned tools, and layout | 3 days |
| **Quick-switch UI** | Dropdown or hotkey (Ctrl+W) to jump between workspaces | 1 day |
| **Workspace-scoped storage** | Each workspace stores its own tools, categories, and preferences; shared runbook across workspaces | 2 days |
| **Default workspace** | Set a workspace as default on launch; fallback if none selected | 1 day |
| **Workspace sync** | Include workspace data in Firebase cloud sync payloads | 2 days |

**Outcome:** Users with multiple roles or projects can maintain separate, clean tool decks without clutter.

---

## Phase 7: Dashboard & Insights — *~2 weeks*

**Goal:** Surface usage patterns so users can optimize their workflows.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Usage dashboard page** | New page showing launch frequency, most-used tools, peak usage times, and category distribution | 3 days |
| **Weekly digest view** | Summary card: "This week you launched 47 tools, your top 3 were…" | 1 day |
| **Tool health indicators** | Flag tools not launched in 30+ days; suggest archive or removal | 1 day |
| **Launch streaks** | Track daily usage streaks for gamification / habit building | 1 day |
| **Export insights** | Download usage data as CSV or JSON for external analysis | 1 day |
| **Privacy-first** | All analytics computed locally; no data leaves the browser unless cloud sync is enabled | 1 day |

**Outcome:** Users understand which tools drive value and which are dead weight.

---

## Phase 8: Automation & Workflows — *~2.5 weeks*

**Goal:** Go beyond single-tool launches — let users trigger multi-step workflows.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Launch chains** | Define ordered sequences of tools to open (e.g. "Morning standup" opens Slack, Jira, and Google Meet) | 3 days |
| **Timed triggers** | Optional: show a prompt at a configured time ("It's 9 AM — launch your standup chain?") | 2 days |
| **One-click chains** | Launch chain button on command deck; keyboard shortcut support | 1 day |
| **Chain builder UI** | Drag-and-drop or checklist interface to compose chains from existing tools | 2 days |
| **Chain templates** | Pre-built chains in starter packs (e.g. "Developer Morning", "Content Review") | 1 day |

**Outcome:** Central Command becomes an active workflow engine, not just a launcher.

---

## Phase 9: Collaboration & Sharing — *~2 weeks*

**Goal:** Let users share tool configurations with teammates or the community.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Shareable tool packs** | Export a curated set of tools as a JSON bundle with a share link | 2 days |
| **Import from URL** | Paste a share link to import someone else's tool pack | 1 day |
| **Pack gallery page** | Browse community-submitted packs (static JSON registry or GitHub-backed) | 2 days |
| **Team sync (optional)** | Shared Firestore collection for a team; admin can push "recommended tools" | 3 days |
| **Collaborative runbook** | Real-time or turn-based shared runbook for team standups | 2 days |

**Outcome:** Central Command tools and workflows become portable and social.

---

## Phase 10: Accessibility & Internationalization — *~1.5 weeks*

**Goal:** Make Central Command usable by everyone, everywhere.

| Feature | Description | Effort |
|---------|-------------|--------|
| **WCAG 2.1 AA audit** | Full accessibility pass: contrast, ARIA labels, screen reader testing, focus management | 2 days |
| **Keyboard-only mode** | Ensure every feature is fully operable without a mouse | 1 day |
| **Reduced motion** | Respect `prefers-reduced-motion`; disable animations when set | 0.5 days |
| **i18n framework** | Extract all UI strings into a locale file; support English + 1 additional language | 2 days |
| **RTL layout support** | Ensure layout works for right-to-left languages | 1 day |
| **High contrast theme** | Add a high-contrast theme option alongside light/dark | 1 day |

**Outcome:** No user is excluded by language, ability, or preference.

---

## Phase 11: Advanced Search & Navigation — *~1.5 weeks*

**Goal:** Make finding and reaching tools instant, even at scale.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Fuzzy search** | Typo-tolerant matching in command palette and tool grid (e.g. "slck" → Slack) | 2 days |
| **Recent + frecency ranking** | Rank search results by frequency × recency, not just alphabetical | 1 day |
| **Tag system** | Add freeform tags to tools; filter and search by tag | 2 days |
| **Saved filters** | Save a filter combination (category + tags + query) as a named view | 1 day |
| **Deep link to views** | URL hash routes for category/tag/filter combos (e.g. `#/tag/deploy`) | 1 day |

**Outcome:** Users with 100+ tools can find anything in under 2 seconds.

---

## Phase 12: Plugin & Extension System — *~3 weeks*

**Goal:** Allow third-party or user-built extensions without modifying core code.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Plugin API** | Define a lightweight plugin interface: `register()`, lifecycle hooks, access to tool state | 3 days |
| **Plugin manager UI** | Enable/disable/configure installed plugins from a settings page | 2 days |
| **Built-in plugins** | Ship 3–4 first-party plugins: Pomodoro timer, bookmark importer, clipboard launcher, weather widget | 3 days |
| **Plugin sandboxing** | Run plugins in isolated scope; prevent access to auth tokens or raw storage | 2 days |
| **Plugin marketplace (v1)** | GitHub-backed registry of community plugins with install-from-URL | 2 days |

**Outcome:** Central Command becomes a platform that others can extend.

---

## Phase 13: Mobile-First Enhancements — *~2 weeks*

**Goal:** Optimize the experience for phone and tablet users.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Touch gestures** | Swipe to pin/unpin, long-press for context menu, pull-to-refresh | 2 days |
| **Bottom navigation** | Move primary nav to bottom bar on mobile for thumb-friendly access | 1 day |
| **Compact card mode** | Auto-switch to minimal card layout on small screens | 1 day |
| **Offline indicator** | Prominent banner when offline; queue status visible | 1 day |
| **App icon customization** | Let users pick a custom PWA icon and splash screen color | 1 day |
| **Share target API** | Register as a share target so mobile users can share URLs directly into Central Command as new tools | 2 days |

**Outcome:** Mobile feels like a native app, not a shrunken desktop page.

---

## Phase 14: Security & Data Sovereignty — *~2 weeks*

**Goal:** Give users full control and confidence over their data.

| Feature | Description | Effort |
|---------|-------------|--------|
| **End-to-end encryption** | Encrypt tool data before writing to Firestore; decrypt on read with user-held key | 3 days |
| **Data export (full)** | One-click export of all data (tools, history, runbook, settings, workspaces) as a ZIP archive | 1 day |
| **Data import (full)** | Restore from a full export; migration validation for version mismatches | 1 day |
| **Account deletion** | Wipe all cloud data with one button; confirm and log the action | 1 day |
| **Audit log** | Local log of significant actions (sync events, bulk deletes, imports) for troubleshooting | 1 day |
| **CSP hardening** | Add Content-Security-Policy headers; restrict script sources | 1 day |
| **Dependency review** | Audit Firebase SDK and any future dependencies for known vulnerabilities | 1 day |

**Outcome:** Users trust Central Command with sensitive tool URLs and workflow data.

---

## Phase 15: Multi-Platform & Distribution — *~3 weeks*

**Goal:** Bring Central Command beyond the browser.

| Feature | Description | Effort |
|---------|-------------|--------|
| **Desktop wrapper (Electron/Tauri)** | Package as a native desktop app with system tray, global hotkey to summon | 3 days |
| **Browser extension** | Chrome/Firefox extension: click to add current page as a tool; quick-launch from toolbar | 3 days |
| **CLI companion** | `central-command open <tool-name>` from terminal; reads from same localStorage/sync | 2 days |
| **Widget / sidebar mode** | Embeddable sidebar that can float over other apps (desktop wrapper feature) | 2 days |
| **Auto-update** | For desktop app: check for new versions and prompt to update | 1 day |
| **App store listings** | Publish PWA to Microsoft Store and Google Play via PWABuilder | 2 days |

**Outcome:** Central Command is available wherever users work — browser, desktop, terminal, or mobile store.

---

## Summary (Phases 6–15)

| Phase | Focus | Timeline |
|-------|-------|----------|
| 6 | Workspaces & Contexts | ~2 weeks |
| 7 | Dashboard & Insights | ~2 weeks |
| 8 | Automation & Workflows | ~2.5 weeks |
| 9 | Collaboration & Sharing | ~2 weeks |
| 10 | Accessibility & i18n | ~1.5 weeks |
| 11 | Advanced Search & Navigation | ~1.5 weeks |
| 12 | Plugin & Extension System | ~3 weeks |
| 13 | Mobile-First Enhancements | ~2 weeks |
| 14 | Security & Data Sovereignty | ~2 weeks |
| 15 | Multi-Platform & Distribution | ~3 weeks |

**Total (Phases 6–15):** ~21 weeks of focused work.

---

## How to Use This Roadmap

- **Prioritize** within each phase based on user feedback.
- **Defer** lower-priority items if timelines change.
- **Phases are sequential but flexible** — items can be pulled forward if demand warrants it.
- **Measure** each phase with clear success metrics before moving to the next.
- **Ship incrementally** — each phase should result in a deployable release.
