import assert from "node:assert";

// Minimal DOM mock for nav tests
const elements = {};
global.document = {
  createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      className: "",
      id: "",
      innerHTML: "",
      hidden: false,
      parentNode: null,
      childNodes: [],
      children: [],
      _attrs: {},
      style: {},
      setAttribute(k, v) { el._attrs[k] = v; },
      getAttribute(k) { return el._attrs[k]; },
      removeAttribute(k) { delete el._attrs[k]; },
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); },
        toggle(c, force) {
          if (force) this._set.add(c);
          else this._set.delete(c);
        },
      },
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      appendChild(child) {
        child.parentNode = el;
        el.children.push(child);
        return child;
      },
      insertBefore(child, ref) {
        child.parentNode = el;
        el.children.push(child);
        return child;
      },
      closest() { return null; },
      append(...nodes) { nodes.forEach(n => el.appendChild(n)); },
    };
    return el;
  },
  querySelector(sel) { return elements[sel] || null; },
  addEventListener() {},
  head: { appendChild() {} },
  body: { appendChild() {}, style: {} },
};
global.window = { location: { href: "" } };
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] ?? null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; },
};
global.sessionStorage = global.localStorage;

// Test that the module exports exist and are callable
const { sanitizeIntegrationsPreferences, validateIntegrationUrl, DEFAULT_INTEGRATIONS } = await import("../lib/integrations.js");

// validateIntegrationUrl with various inputs
const valid1 = validateIntegrationUrl("https://example.com");
assert.strictEqual(valid1.isValid, true);

const valid2 = validateIntegrationUrl("");
assert.strictEqual(valid2.url, DEFAULT_INTEGRATIONS.creativeHub.url);

const valid3 = validateIntegrationUrl("localhost:3000");
assert.strictEqual(valid3.isValid, true);

// sanitizeIntegrationsPreferences edge cases
const withBadOpenMode = sanitizeIntegrationsPreferences({
  creativeHub: { openMode: "invalid-mode" }
});
assert.strictEqual(withBadOpenMode.creativeHub.openMode, "new-tab");

const withNestedNull = sanitizeIntegrationsPreferences({ creativeHub: null });
assert.ok(withNestedNull.creativeHub);
assert.strictEqual(withNestedNull.creativeHub.enabled, true);

console.log("nav.test.js: all assertions passed");
export default { ok: true };
