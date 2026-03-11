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

## Summary

| Phase | Focus | Timeline |
|-------|-------|----------|
| 1 | Polish & UX | ~1 week |
| 2 | Cross-device sync | ~2 weeks |
| 3 | Power user | ~1.5 weeks |
| 4 | Extensibility | ~2 weeks |
| 5 | Scale & reliability | ~1.5 weeks |

**Total:** ~8 weeks of focused work.

---

## How to Use This Roadmap

- **Prioritize** within each phase based on user feedback.
- **Defer** lower-priority items if timelines change.
- **Revisit** after Phase 2; sync may reveal new needs.
