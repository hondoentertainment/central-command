# Self-Hosted Fonts

This directory holds woff2 font files served locally instead of from Google Fonts.

## Required files

Run `bash scripts/download-fonts.sh` to fetch them automatically, or place these
files here manually:

| File | Font | Weight | Style |
|------|------|--------|-------|
| dm-sans-v15-latin-regular.woff2 | DM Sans | 400 | normal |
| dm-sans-v15-latin-500.woff2 | DM Sans | 500 | normal |
| dm-sans-v15-latin-600.woff2 | DM Sans | 600 | normal |
| dm-sans-v15-latin-700.woff2 | DM Sans | 700 | normal |
| dm-sans-v15-latin-italic.woff2 | DM Sans | 400 | italic |
| instrument-serif-v1-latin-regular.woff2 | Instrument Serif | 400 | normal |
| instrument-serif-v1-latin-italic.woff2 | Instrument Serif | 400 | italic |
| jetbrains-mono-v18-latin-regular.woff2 | JetBrains Mono | 400 | normal |
| jetbrains-mono-v18-latin-500.woff2 | JetBrains Mono | 500 | normal |

The corresponding `@font-face` declarations live in `css/fonts.css`.
