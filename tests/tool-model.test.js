import assert from "node:assert";
import {
  sanitizeTool,
  isValidLaunchTarget,
  normalizeUrl,
  collapseWhitespace,
  sanitizeSurfaces,
} from "../lib/tool-model.js";

// --- sanitizeTool ---
assert.strictEqual(sanitizeTool(null), null);
assert.strictEqual(sanitizeTool(undefined), null);
assert.strictEqual(sanitizeTool({}), null);

const minimal = sanitizeTool({
  name: " Gmail ",
  url: "  https://mail.google.com  ",
  category: "Comms",
  description: "Email client",
});
assert.ok(minimal);
assert.strictEqual(minimal.name, "Gmail");
assert.strictEqual(minimal.url, "https://mail.google.com");
assert.strictEqual(minimal.category, "Comms");
assert.strictEqual(minimal.description, "Email client");
assert.strictEqual(minimal.accent, "amber");
assert.strictEqual(minimal.iconKey, "auto");
assert.strictEqual(minimal.pinned, false);
assert.strictEqual(minimal.pinRank, null);
assert.deepStrictEqual(minimal.surfaces, []);

const withPinned = sanitizeTool({
  name: "x",
  url: "https://x.com",
  category: "Social",
  description: "d",
  pinned: true,
  pinRank: 2,
});
assert.ok(withPinned.pinned);
assert.strictEqual(withPinned.pinRank, 2);

const withCustomIcon = sanitizeTool({
  name: "Custom",
  url: "https://custom.com",
  category: "Test",
  description: "d",
  iconKey: "custom",
  iconUrl: "https://example.com/icon.png",
});
assert.strictEqual(withCustomIcon.iconKey, "custom");
assert.strictEqual(withCustomIcon.iconUrl, "https://example.com/icon.png");

const invalidIconUrl = sanitizeTool({
  name: "x",
  url: "https://x.com",
  category: "x",
  description: "x",
  iconKey: "custom",
  iconUrl: "not-a-url",
});
assert.strictEqual(invalidIconUrl.iconUrl, undefined);

// --- isValidLaunchTarget ---
assert.strictEqual(isValidLaunchTarget("https://example.com"), true);
assert.strictEqual(isValidLaunchTarget("http://a.co"), true);
assert.strictEqual(isValidLaunchTarget("file:///C:/Users/test"), true);
assert.strictEqual(isValidLaunchTarget("steam://run/123"), true);
assert.strictEqual(isValidLaunchTarget("C:\\Program Files\\app.exe"), true);
assert.strictEqual(isValidLaunchTarget("\\\\server\\share"), true);
assert.strictEqual(isValidLaunchTarget("localhost:3000"), true);
assert.strictEqual(isValidLaunchTarget("example.com/path"), true);
assert.strictEqual(isValidLaunchTarget(""), false);
assert.strictEqual(isValidLaunchTarget("  "), false);
assert.strictEqual(isValidLaunchTarget("not a url"), false);

// --- normalizeUrl ---
assert.strictEqual(normalizeUrl("https://example.com"), "https://example.com");
assert.strictEqual(normalizeUrl("example.com"), "https://example.com");
assert.strictEqual(normalizeUrl("C:\\foo\\bar"), "file:///C:/foo/bar");
assert.strictEqual(normalizeUrl("\\\\server\\share"), "file://server/share");

// --- collapseWhitespace ---
assert.strictEqual(collapseWhitespace("  a  b  "), "a b");
assert.strictEqual(collapseWhitespace(null), "");
assert.strictEqual(collapseWhitespace(undefined), "");

// --- sanitizeSurfaces ---
assert.deepStrictEqual(sanitizeSurfaces(["hero", "spotlight"]), ["hero", "spotlight"]);
assert.deepStrictEqual(sanitizeSurfaces(["hero", "invalid", "spotlight"]), ["hero", "spotlight"]);
assert.deepStrictEqual(sanitizeSurfaces(null), []);
assert.deepStrictEqual(sanitizeSurfaces("not array"), []);

console.log("tool-model.test.js: all assertions passed");
export default { ok: true };
