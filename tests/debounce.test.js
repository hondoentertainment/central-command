import assert from "node:assert";
import { debounce } from "../lib/debounce.js";

// --- debounce delays execution ---
let callCount = 0;
const fn = debounce(() => { callCount++; }, 50);

fn();
fn();
fn();
assert.strictEqual(callCount, 0, "Should not call immediately");

await new Promise((r) => setTimeout(r, 100));
assert.strictEqual(callCount, 1, "Should call once after delay");

// --- debounce.cancel prevents execution ---
let cancelled = 0;
const fn2 = debounce(() => { cancelled++; }, 50);
fn2();
fn2.cancel();
await new Promise((r) => setTimeout(r, 100));
assert.strictEqual(cancelled, 0, "Should not call after cancel");

// --- debounce passes arguments ---
let receivedArgs = null;
const fn3 = debounce((...args) => { receivedArgs = args; }, 30);
fn3("a", "b");
await new Promise((r) => setTimeout(r, 80));
assert.deepStrictEqual(receivedArgs, ["a", "b"], "Should pass arguments");

console.log("debounce.test.js: all assertions passed");
export default { ok: true };
