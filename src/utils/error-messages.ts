type ErrorLike = {
  message?: string
  code?: string
  status?: number
}

const toErrorLike = (error: unknown): ErrorLike => {
  if (error && typeof error === "object") {
    return error as ErrorLike
  }
  return {}
}

const normalize = (value?: string): string => (value ?? "").trim().toLowerCase()

export const getUserFacingAuthError = (
  error: unknown,
  fallback = "No pudimos completar la solicitud. Intenta nuevamente.",
): string => {
  const parsed = toErrorLike(error)
  const message = normalize(parsed.message)
  const code = normalize(parsed.code)
  const status = parsed.status

  if (
    status === 429 ||
    message.includes("rate limit") ||
    message.includes("too many") ||
    code.includes("over_request_rate_limit")
  ) {
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."
  }

  if (
    message.includes("invalid login") ||
    message.includes("invalid credentials") ||
    message.includes("invalid email or password") ||
    message.includes("invalid_grant")
  ) {
    return "Correo o contraseña incorrectos."
  }

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("connection") ||
    message.includes("timeout")
  ) {
    return "No pudimos conectar. Revisa tu internet e inténtalo de nuevo."
  }

  if (
    message.includes("expired") ||
    message.includes("invalid token") ||
    message.includes("invalid or has expired")
  ) {
    return "El enlace no es válido o ya venció. Solicita uno nuevo."
  }

  return fallback
}
