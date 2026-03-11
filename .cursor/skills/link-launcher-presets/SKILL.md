---
name: link-launcher-presets
description: Add or modify preset packs and tools in Central Command. Use when adding new starter packs, tools to presets, new categories, or new icon keys.
---

# Link Launcher Presets

## Where to Edit

`data/presets.js` — contains `createTool`, `CATEGORY_OPTIONS`, `PRESET_PACKS`, `DEFAULT_TOOLS`, and `ALL_PRESET_TOOLS`.

## createTool Helper

Use `createTool()` for every preset tool. It supplies defaults and UUIDs:

```javascript
createTool({
  name: "Gmail",
  url: "https://mail.google.com",
  category: "Comms",
  description: "Inbox triage and daily communication.",
  accent: "amber",           // optional, default "amber"
  pinned: true,              // optional, default false
  pinRank: 1,                // required if pinned
  surfaces: ["hero"],        // optional, default []
  iconKey: "gmail",          // optional, default "auto"
  shortcutLabel: "G",        // optional, default ""
  openMode: "new-tab",       // optional, default "new-tab"
})
```

## Valid Values

- **accent**: `amber`, `teal`, `crimson`, `cobalt`
- **surfaces**: `hero`, `spotlight` — array, can be empty
- **openMode**: `new-tab`, `same-tab`
- **iconKey**: Must exist in `lib/icons.js` `ICON_OPTIONS`. Use `generic` for apps without a dedicated icon, or add a new icon first.

## Adding a New Preset Pack

1. Add a new object to `PRESET_PACKS`:

```javascript
{
  id: "my-pack",
  title: "My Pack",
  description: "Short description for the preset card.",
  tools: [
    createTool({ name: "...", url: "...", category: "...", description: "..." }),
    // ...
  ],
}
```

2. Ensure `id` is unique and URL-friendly.
3. Tools are ordered by pinned first (by pinRank), then by name. Assign sequential `pinRank` for pinned tools.

## Adding a New Category

Add to `CATEGORY_OPTIONS` in `data/presets.js`:

```javascript
export const CATEGORY_OPTIONS = [
  "AI",
  "Build",
  // ...
  "MyCategory",
];
```

Categories are sorted alphabetically in the UI. Custom categories work without being in this list but won't appear in the dropdown until a tool uses them.

## Adding a New Icon

1. In `lib/icons.js`, add to `ICON_OPTIONS`:
   ```javascript
   { value: "myapp", label: "MyApp" },
   ```

2. Add an SVG to `appIcons` with the same key:
   ```javascript
   myapp: `<svg viewBox="0 0 24 24" ...>...</svg>`,
   ```

3. In `getIconMarkup`, add auto-detect logic if the app name/URL can be inferred (optional).

## Checklist for New Presets

- [ ] Pack has unique `id`, clear `title`, and `description`
- [ ] All tools use `createTool()`
- [ ] Every tool has valid `name`, `url`, `category`, `description`
- [ ] `iconKey` is from `ICON_OPTIONS` or `auto`
- [ ] Pinned tools have sequential `pinRank`
- [ ] `surfaces` only uses `hero` or `spotlight`
- [ ] URLs are valid (http/https, file, or app protocol)
