# Contributing

## Run locally

From the repo root:

```bash
npm run dev
```

This runs `npx serve . -p 3000`. Open http://localhost:3000 (or the port shown). Alternatively:

```bash
npx serve . -p 3000
```

## Tests

- **Unit tests:** `npm test` (runs `node tests/run.js`).
- **E2E tests:** `npm run test:e2e` (Playwright). Use `npm run test:e2e:ui` for the Playwright UI.

## Before opening a PR

1. Run unit tests: `npm test`
2. Run E2E tests: `npm run test:e2e`
3. Ensure both suites pass before submitting.

Keep PRs focused; mention any new or changed behavior in the description.
