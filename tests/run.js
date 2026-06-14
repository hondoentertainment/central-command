#!/usr/bin/env node
/**
 * Minimal test runner. Runs test files and reports results.
 * Usage: node tests/run.js
 */
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = join(__dirname);

const testFiles = [
  "auth-security.test.js",
  "theme.test.js",
  "command-palette.test.js",
  "tool-model.test.js",
  "tool-model-extended.test.js",
  "storage.test.js",
  "integrations.test.js",
  "debounce.test.js",
  "nav.test.js",
];

let passed = 0;
let failed = 0;

for (const file of testFiles) {
  const path = join(testDir, file);
  try {
    await import(pathToFileURL(path).href);
    console.log(`✓ ${file}\n`);
    passed++;
  } catch (err) {
    console.error(`✗ ${file}`);
    console.error(err.message || err);
    if (err.stack) console.error(err.stack);
    console.error("");
    failed++;
  }
}

console.log("---");
console.log(`Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
