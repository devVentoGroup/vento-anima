/**
 * Utilidades para autenticación.
 * Cuenta de revisión (Apple/Google): allowlist de emails que usan password fijo.
 */

const REVIEW_EMAILS = (process.env.EXPO_PUBLIC_REVIEW_EMAILS || "")
  .split(",")
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

/** Email está en la allowlist de revisión (login con contraseña fija para reviewers). */
export function isReviewEmail(email: string): boolean {
  if (!email) return false;
  return REVIEW_EMAILS.includes(email.trim().toLowerCase());
}
