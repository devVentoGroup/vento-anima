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

export type AttendanceErrorDomain = "gps" | "network" | "db" | "sync" | "geofence" | "unknown"

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

export const getUserFacingAttendanceError = (
  error: unknown,
  fallback = "No se pudo completar el registro."
): { domain: AttendanceErrorDomain; message: string } => {
  const parsed = toErrorLike(error)
  const message = normalize(parsed.message)
  const code = normalize(parsed.code)
  const status = parsed.status

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("connection") ||
    message.includes("timeout") ||
    status === 0
  ) {
    return {
      domain: "network",
      message: "Sin conexión estable. Guardaremos el registro cuando sea posible.",
    }
  }

  if (
    message.includes("gps") ||
    message.includes("accuracy") ||
    message.includes("ubicación") ||
    message.includes("location")
  ) {
    return {
      domain: "gps",
      message: "No pudimos validar la ubicación. Intenta de nuevo dentro de la sede.",
    }
  }

  if (
    code.startsWith("23") ||
    code === "p0001" ||
    message.includes("conflict") ||
    message.includes("conflicto")
  ) {
    return {
      domain: "sync",
      message: "Detectamos un conflicto de registro. Reintentaremos automáticamente.",
    }
  }

  if (
    message.includes("postgres") ||
    message.includes("sql") ||
    message.includes("supabase") ||
    status === 500
  ) {
    return {
      domain: "db",
      message: "No pudimos guardar el registro en este momento. Reintenta en unos segundos.",
    }
  }

  if (
    message.includes("fuera de rango") ||
    message.includes("sede") ||
    message.includes("geofence")
  ) {
    return {
      domain: "geofence",
      message: "Debes validar ubicación en sede para registrar sin internet.",
    }
  }

  return {
    domain: "unknown",
    message: fallback,
  }
}
