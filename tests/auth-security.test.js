import assert from "node:assert";
import {
  mapAuthError,
  evaluatePasswordStrength,
  canUserWriteCloudSync,
  getAccountTier,
} from "../lib/auth-policy.js";

// --- error mapping ---
assert.strictEqual(
  mapAuthError({ code: "auth/invalid-email" }),
  "That email address looks invalid."
);
assert.strictEqual(
  mapAuthError({ code: "auth/invalid-credential" }),
  "Incorrect email or password."
);
assert.strictEqual(
  mapAuthError({ code: "auth/too-many-requests" }),
  "Too many attempts. Try again later."
);

// --- password policy ---
assert.strictEqual(evaluatePasswordStrength("short").isValid, false);
assert.strictEqual(evaluatePasswordStrength("LongerNoNum!").isValid, false);
assert.strictEqual(evaluatePasswordStrength("StrongPass1!").isValid, true);

// --- account tiers and sync gating ---
assert.strictEqual(getAccountTier(null), "signed-out");
assert.strictEqual(getAccountTier({ isAnonymous: true, emailVerified: false }), "guest");
assert.strictEqual(getAccountTier({ isAnonymous: false, emailVerified: false }), "unverified");
assert.strictEqual(getAccountTier({ isAnonymous: false, emailVerified: true }), "verified");

assert.strictEqual(canUserWriteCloudSync(null), false);
assert.strictEqual(canUserWriteCloudSync({ isAnonymous: true, emailVerified: false }), false);
assert.strictEqual(canUserWriteCloudSync({ isAnonymous: false, emailVerified: false }), false);
assert.strictEqual(canUserWriteCloudSync({ isAnonymous: false, emailVerified: true }), true);

console.log("auth-security.test.js: all assertions passed");
export default { ok: true };
