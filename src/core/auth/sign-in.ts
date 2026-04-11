const SIGN_IN_MIN_INTERVAL_MS = 2500

type RetryableError = Error & {
  status?: number
  retry_after_seconds?: number
}

type SignInRateLimitRefs = {
  signInInFlightRef: React.MutableRefObject<boolean>
  signInLastAttemptAtRef: React.MutableRefObject<number>
  signInLastEmailRef: React.MutableRefObject<string | null>
  signInCooldownUntilRef: React.MutableRefObject<number>
}

type SignInExecutor = (args: { email: string; password: string }) => Promise<{ error: any }>

function parseRetryAfterSeconds(input: unknown): number {
  const anyErr = input as any
  const message = String(anyErr?.message ?? "").toLowerCase()
  const fromField = Number(anyErr?.retry_after_seconds)
  if (Number.isFinite(fromField) && fromField > 0) {
    return Math.ceil(fromField)
  }

  const secondsMatch = message.match(/(\d+)\s*(seconds|second|secs|sec|s)\b/)
  if (secondsMatch) {
    return Math.max(1, Number(secondsMatch[1]))
  }

  const minutesMatch = message.match(/(\d+)\s*(minutes|minute|mins|min|m)\b/)
  if (minutesMatch) {
    return Math.max(1, Number(minutesMatch[1]) * 60)
  }

  return 0
}

export async function signInWithRateLimit(
  email: string,
  password: string,
  refs: SignInRateLimitRefs,
  executeSignIn: SignInExecutor,
) {
  const normalizedEmail = email.trim().toLowerCase()
  const now = Date.now()
  const {
    signInInFlightRef,
    signInLastAttemptAtRef,
    signInLastEmailRef,
    signInCooldownUntilRef,
  } = refs

  if (!normalizedEmail || !password) {
    const invalidError: RetryableError = new Error("Credenciales incompletas.")
    invalidError.status = 400
    throw invalidError
  }

  if (signInInFlightRef.current) {
    const lockedError: RetryableError = new Error("Inicio de sesión en curso. Espera un momento.")
    lockedError.status = 429
    lockedError.retry_after_seconds = 2
    throw lockedError
  }

  if (now < signInCooldownUntilRef.current) {
    const secondsLeft = Math.max(1, Math.ceil((signInCooldownUntilRef.current - now) / 1000))
    const cooldownError: RetryableError = new Error(`Demasiados intentos. Espera ${secondsLeft} segundos.`)
    cooldownError.status = 429
    cooldownError.retry_after_seconds = secondsLeft
    throw cooldownError
  }

  const isRapidDuplicate =
    signInLastEmailRef.current === normalizedEmail &&
    now - signInLastAttemptAtRef.current < SIGN_IN_MIN_INTERVAL_MS
  if (isRapidDuplicate) {
    const waitSeconds = Math.max(
      1,
      Math.ceil((SIGN_IN_MIN_INTERVAL_MS - (now - signInLastAttemptAtRef.current)) / 1000),
    )
    const duplicateError: RetryableError = new Error(`Espera ${waitSeconds} segundos antes de reintentar.`)
    duplicateError.status = 429
    duplicateError.retry_after_seconds = waitSeconds
    throw duplicateError
  }

  signInInFlightRef.current = true
  signInLastAttemptAtRef.current = now
  signInLastEmailRef.current = normalizedEmail

  try {
    const { error } = await executeSignIn({
      email: normalizedEmail,
      password,
    })

    if (error) {
      const retrySeconds = parseRetryAfterSeconds(error)
      if (retrySeconds > 0) {
        signInCooldownUntilRef.current = Date.now() + retrySeconds * 1000
      }
      throw error
    }

    signInCooldownUntilRef.current = 0
  } finally {
    signInInFlightRef.current = false
  }
}
