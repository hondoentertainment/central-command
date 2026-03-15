import assert from "node:assert";
import { getTheme, setTheme, toggleTheme } from "../lib/theme.js";

const store = {};
const meta = { content: "" };
const classNames = new Set();

global.localStorage = {
  getItem(key) {
    return store[key] ?? null;
  },
  setItem(key, value) {
    store[key] = String(value);
  },
};

global.document = {
  documentElement: {
    classList: {
      add(...values) {
        values.forEach((value) => classNames.add(value));
      },
      remove(...values) {
        values.forEach((value) => classNames.delete(value));
      },
    },
  },
  querySelector(selector) {
    return selector === 'meta[name="theme-color"]' ? meta : null;
  },
};

assert.strictEqual(getTheme(), "dark");

setTheme("light");
assert.strictEqual(store["central-command.theme"], "light");
assert.ok(classNames.has("theme-light"));
assert.strictEqual(meta.content, "#f0f4fa");

const toggled = toggleTheme();
assert.strictEqual(toggled, "dark");
assert.ok(classNames.has("theme-dark"));
assert.strictEqual(store["central-command.theme"], "dark");
assert.strictEqual(meta.content, "#0f0f0f");

console.log("theme.test.js: all assertions passed");
export default { ok: true };
