---
name: ux-presentation-standards
description: Enforce professional UX and presentation standards. Use when building or editing UI, fixing "noticeable issues" in presentation, or auditing pages for visual consistency, spacing, typography, and accessibility.
---

# UX Presentation Standards (Agent)

Use this skill when the user wants to **raise presentation quality**, fix **noticeable UI issues**, or ensure **professional website standards** across Central Command. Works alongside the rule in `.cursor/rules/ux-presentation-standards.mdc`.

## When to Use

- User reports "noticeable issues in presentation," "looks off," or "unprofessional"
- Adding or changing HTML/CSS or content pages (e.g. movies, music, runbook)
- Before release or deploy: quick presentation and consistency pass
- User asks for "UX best practices" or "professional website standards"

## Audit Checklist (run through each area)

### 1. Visual consistency

- **Tokens**: All colors and main spacing use CSS variables from `styles.css`. No one-off hex or pixel values unless justified.
- **Spacing**: Same padding/margin rhythm as the rest of the app (e.g. panels, cards, sections). No orphan margins (e.g. 13px, 11px) that break alignment.
- **Typography**: One `h1` per page; heading order intact; body uses design system fonts and line-height; secondary text uses `--text-secondary` / `--muted`.

### 2. Layout and alignment

- Sections and cards align to the same horizontal edges; no accidental misalignment from mixed padding or margins.
- Content doesn’t overflow or cause horizontal scroll at 320px–1920px unless intentional (e.g. code blocks).
- New pages use the same content shell (header, nav, main) and panel/link-block patterns as existing pages (e.g. music, movies).

### 3. Interactive elements

- Buttons and key links have ~44px min touch target where they’re primary actions.
- All focusable elements have a visible `:focus-visible` (or equivalent) state; no focus traps or missing skip targets for key flows.
- Icon-only controls have `aria-label` or equivalent; primary actions are clearly labeled.

### 4. States and feedback

- Hover (and active/disabled where relevant) is defined for buttons and links.
- Loading, empty, and error states show clear copy and a next action where applicable (no blank or raw "undefined" UI).

### 5. Accessibility baseline

- Sufficient contrast (e.g. `--text` and `--text-secondary` on `--bg`) for WCAG AA.
- No `user-scalable=no`; zoom and text scaling remain usable.
- Form inputs have visible labels (not only placeholders); errors are associated and announced.

## Output Format

When running an audit:

1. **Summary**: 1–2 sentences on overall presentation and top risk areas.
2. **Findings**: List per area (visual consistency, layout, interactive, states, a11y). For each: **Issue** (what’s wrong) and **Fix** (concrete change: file, selector, or token).
3. **Priority**: Mark each finding High / Medium / Low so the user can fix in order.

## Project context

- **Central Command** uses vanilla JS, static HTML pages, and a single `styles.css` with design tokens. Content pages (music, movies, sports, etc.) share `content-page`, `content-shell`, `content-header`, and panel/link-block patterns.
- Reuse existing classes and tokens; only introduce new ones when the design system doesn’t cover the case. When in doubt, mirror the structure of an existing content page (e.g. `music.html` / `movies.html`).
