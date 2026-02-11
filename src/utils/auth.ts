/**
 * Utilidades para autenticación.
 * Cuenta de revisión (Apple/Google): allowlist de emails que usan password fijo.
 * En login, si el email es de revisión, se usa siempre esta contraseña para que
 * Apple/Google puedan acceder aunque escriban mal la contraseña en App Store Connect.
 */

const REVIEW_EMAILS = (process.env.EXPO_PUBLIC_REVIEW_EMAILS || "")
  .split(",")
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

const REVIEW_PASSWORD = (process.env.EXPO_PUBLIC_REVIEW_PASSWORD || "").trim();

/** Email está en la allowlist de revisión (login con contraseña fija para reviewers). */
export function isReviewEmail(email: string): boolean {
  if (!email) return false;
  return REVIEW_EMAILS.includes(email.trim().toLowerCase());
}

/** Contraseña fija para cuentas de revisión (Apple/Google). Usar solo si isReviewEmail(email). */
export function getReviewPassword(): string {
  return REVIEW_PASSWORD;
}
