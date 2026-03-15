/**
 * Shared auth and security policy helpers.
 */

export const MIN_PASSWORD_LENGTH = 8;

export function mapAuthError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-email")) return "That email address looks invalid.";
  if (code.includes("user-not-found")) return "No account found for that email.";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Incorrect email or password.";
  }
  if (code.includes("email-already-in-use")) return "That email is already in use.";
  if (code.includes("weak-password")) return "Password is too weak.";
  if (code.includes("too-many-requests")) return "Too many attempts. Try again later.";
  if (code.includes("requires-recent-login")) {
    return "Please sign in again, then retry this action.";
  }
  return err?.message || "Authentication failed. Please try again.";
}

export function evaluatePasswordStrength(password) {
  const value = String(password ?? "");
  if (!value) return { score: 0, label: "No password", isValid: false };

  const hasMixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);

  let score = 0;
  if (value.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (hasMixedCase) score += 1;
  if (hasNumber) score += 1;
  if (hasSymbol) score += 1;

  const label =
    score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";
  const isValid = value.length >= MIN_PASSWORD_LENGTH && hasMixedCase && hasNumber && hasSymbol;

  return { score, label, isValid };
}

export function getAccountTier(user) {
  if (!user) return "signed-out";
  if (user.isAnonymous) return "guest";
  if (!user.emailVerified) return "unverified";
  return "verified";
}

export function canUserWriteCloudSync(user) {
  return !!user && !user.isAnonymous && !!user.emailVerified;
}
