import * as Location from "expo-location"
import * as Device from "expo-device"
import { Platform } from "react-native"

export interface LocationResult {
  success: boolean
  error?: string
  errorCode?:
  | "PERMISSION_DENIED"
  | "LOCATION_UNAVAILABLE"
  | "TIMEOUT"
  | "ACCURACY_TOO_LOW"
  | "SPOOFING_DETECTED"
  | "UNKNOWN"
  location?: ValidatedLocation
}

export interface ValidatedLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  altitude?: number
  speed?: number
  heading?: number
  isValid: boolean
  validationWarnings: string[]
  deviceInfo: DeviceInfo
}

export interface DeviceInfo {
  isDevice: boolean
  brand?: string
  modelName?: string
  osName?: string
  osVersion?: string
  platform: string
}

export interface SiteCoordinates {
  id: string
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
  requiresGeolocation: boolean
}

const VALIDATION_CONFIG = {
  maxAccuracyMeters: 50,
  maxLocationAgeMs: 30000,
  maxReasonableSpeed: 55,
  locationTimeoutMs: 15000,
}

// ✅ Política estricta para asistencia (check-in)
const CHECKIN_POLICY = {
  // Recomendado para “estricto pero usable”
  maxAccuracyMeters: 25,
  // Cap duro para evitar radios enormes que permiten “media cuadra”
  radiusCapMeters: 35,
  // Muestras para estabilizar lectura
  samples: 4,
  // Timeout total para conseguir una lectura decente
  timeoutMs: 20000,
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function getDeviceInfo(): DeviceInfo {
  return {
    isDevice: Device.isDevice,
    brand: Device.brand ?? undefined,
    modelName: Device.modelName ?? undefined,
    osName: Device.osName ?? undefined,
    osVersion: Device.osVersion ?? undefined,
    platform: Platform.OS,
  }
}

function detectSpoofingPatterns(latitude: number, longitude: number): string[] {
  const warnings: string[] = []

  if (latitude === 0 && longitude === 0) {
    warnings.push("Coordenadas en punto nulo (0,0)")
  }

  const latStr = latitude.toString()
  const lonStr = longitude.toString()

  if (latStr.match(/\.0{4,}$/) || lonStr.match(/\.0{4,}$/)) {
    warnings.push("Coordenadas con patron sospechoso de ceros")
  }

  if (latStr.match(/(\d)\1{5,}$/) || lonStr.match(/(\d)\1{5,}$/)) {
    warnings.push("Coordenadas con digitos repetidos sospechosos")
  }

  if (!Device.isDevice) {
    warnings.push("Ejecutandose en emulador/simulador")
  }

  return warnings
}

export function buildValidatedLocationFromRaw(
  rawLocation: Location.LocationObject
): ValidatedLocation {
  const spoofingWarnings = detectSpoofingPatterns(
    rawLocation.coords.latitude,
    rawLocation.coords.longitude
  )
  const isMocked =
    (rawLocation as any).mocked === true || (rawLocation.coords as any).mocked === true
  if (isMocked) {
    spoofingWarnings.push("Ubicacion simulada (mock) detectada por el sistema")
  }

  const speed = rawLocation.coords.speed
  if (speed && speed > VALIDATION_CONFIG.maxReasonableSpeed) {
    spoofingWarnings.push(`Velocidad sospechosa: ${Math.round(speed * 3.6)} km/h`)
  }

  const deviceInfo = getDeviceInfo()
  const hasBlockingWarnings = spoofingWarnings.some(
    (warning) => warning.includes("punto nulo") || warning.includes("patron sospechoso")
  )

  return {
    latitude: rawLocation.coords.latitude,
    longitude: rawLocation.coords.longitude,
    accuracy: rawLocation.coords.accuracy ?? 999,
    timestamp: rawLocation.timestamp,
    altitude: rawLocation.coords.altitude ?? undefined,
    speed: rawLocation.coords.speed ?? undefined,
    heading: rawLocation.coords.heading ?? undefined,
    isValid: !hasBlockingWarnings,
    validationWarnings: spoofingWarnings,
    deviceInfo,
  }
}

/**
 * Valida que las coordenadas estén en rangos válidos
 */
export function validateCoordinates(latitude: number, longitude: number): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validar latitud (-90 a 90)
  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    errors.push(`Latitud inválida: ${latitude}. Debe estar entre -90 y 90`)
  }

  // Validar longitud (-180 a 180)
  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    errors.push(`Longitud inválida: ${longitude}. Debe estar entre -180 y 180`)
  }

  // Detectar coordenadas en punto nulo (común error)
  if (latitude === 0 && longitude === 0) {
    errors.push("Coordenadas en punto nulo (0,0) - probablemente no configuradas")
  }

  // Detectar coordenadas sospechosas (fuera de Colombia aproximadamente)
  // Colombia está aproximadamente entre lat: 4°N a 12°N y lon: 79°W a 67°W
  if (latitude < -5 || latitude > 15 || longitude > -60 || longitude < -85) {
    errors.push(
      `Coordenadas fuera del rango típico de Colombia: lat=${latitude}, lon=${longitude}. Verifica que no estén invertidas.`
    )
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Genera un enlace de Google Maps para verificar coordenadas
 */
export function getGoogleMapsLink(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

/**
 * Genera un enlace de Google Maps para comparar dos ubicaciones
 */
export function getGoogleMapsComparisonLink(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): string {
  // Enlace que muestra el punto medio y permite ver ambas ubicaciones
  const midLat = (lat1 + lat2) / 2
  const midLon = (lon1 + lon2) / 2
  return `https://www.google.com/maps/@${midLat},${midLon},15z?q=${lat1},${lon1}|${lat2},${lon2}`
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Validar coordenadas antes de calcular
  const validation1 = validateCoordinates(lat1, lon1)
  const validation2 = validateCoordinates(lat2, lon2)

  if (!validation1.isValid) {
    console.warn("[calculateDistance] Coordenadas del usuario inválidas:", validation1.errors)
  }
  if (!validation2.isValid) {
    console.warn("[calculateDistance] Coordenadas del sitio inválidas:", validation2.errors)
  }

  const R = 6371000
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export function isWithinSiteRadius(
  location: ValidatedLocation,
  site: SiteCoordinates
): { isWithin: boolean; distanceMeters: number } {
  const distance = calculateDistance(
    location.latitude,
    location.longitude,
    site.latitude,
    site.longitude
  )

  return {
    isWithin: distance <= site.radiusMeters,
    distanceMeters: Math.round(distance),
  }
}

export async function getValidatedLocation(opts?: {
  maxAccuracyMeters?: number
  samples?: number
  timeoutMs?: number
}): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()

    if (status !== "granted") {
      return {
        success: false,
        error: "Permiso de ubicacion denegado. Activa la ubicacion para hacer check-in.",
        errorCode: "PERMISSION_DENIED",
      }
    }

    const isEnabled = await Location.hasServicesEnabledAsync()
    if (!isEnabled) {
      return {
        success: false,
        error: "Los servicios de ubicacion estan desactivados. Activalos en configuracion.",
        errorCode: "LOCATION_UNAVAILABLE",
      }
    }

    const maxAccuracyMeters = opts?.maxAccuracyMeters ?? VALIDATION_CONFIG.maxAccuracyMeters
    const samples = Math.max(1, Math.min(opts?.samples ?? 1, 6))
    const timeoutMs = opts?.timeoutMs ?? VALIDATION_CONFIG.locationTimeoutMs
    const perSampleTimeoutMs = Math.max(4000, Math.floor(timeoutMs / samples))

    let best: Location.LocationObject | null = null
    let bestAccuracy = Number.POSITIVE_INFINITY

    for (let i = 0; i < samples; i++) {
      const locationPromise = Location.getCurrentPositionAsync({
        // Máxima precisión disponible
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
      })

      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error("TIMEOUT")), perSampleTimeoutMs)
      })

      let candidate: Location.LocationObject
      try {
        candidate = (await Promise.race([locationPromise, timeoutPromise])) as Location.LocationObject
      } catch {
        // Si una muestra falla, seguimos intentando mientras queden muestras
        candidate = null as any
      }

      if (candidate?.coords) {
        const acc = candidate.coords.accuracy ?? 999
        const age = Date.now() - candidate.timestamp

        // Ignora ubicaciones viejas
        if (age <= VALIDATION_CONFIG.maxLocationAgeMs && acc < bestAccuracy) {
          best = candidate
          bestAccuracy = acc
        }

        // Si ya logramos precisión suficiente, paramos temprano
        if (bestAccuracy <= maxAccuracyMeters) break
      }

      // Pequeña pausa para que el GPS “converja”
      if (i < samples - 1) await sleep(700)
    }

    if (!best) {
      return {
        success: false,
        error: "No se pudo obtener la ubicacion. Intenta en un lugar con mejor senal GPS.",
        errorCode: "TIMEOUT",
      }
    }

    const rawLocation = best

    const accuracy = rawLocation.coords.accuracy ?? 999
    if (accuracy > maxAccuracyMeters) {
      return {
        success: false,
        error: `Ubicacion imprecisa (${Math.round(accuracy)}m). Sal al exterior o espera a mejor senal GPS.`,
        errorCode: "ACCURACY_TOO_LOW",
      }
    }

    const locationAge = Date.now() - rawLocation.timestamp
    if (locationAge > VALIDATION_CONFIG.maxLocationAgeMs) {
      return {
        success: false,
        error: "La ubicacion es antigua. Espera a que se actualice tu GPS.",
        errorCode: "LOCATION_UNAVAILABLE",
      }
    }

    const spoofingWarnings = detectSpoofingPatterns(
      rawLocation.coords.latitude,
      rawLocation.coords.longitude
    )
    // ✅ Señal fuerte en Android cuando el OS marca ubicación simulada
    const isMocked =
      (rawLocation as any).mocked === true || (rawLocation.coords as any).mocked === true
    if (isMocked) {
      spoofingWarnings.push("Ubicación simulada (mock) detectada por el sistema")
    }

    const speed = rawLocation.coords.speed
    if (speed && speed > VALIDATION_CONFIG.maxReasonableSpeed) {
      spoofingWarnings.push(`Velocidad sospechosa: ${Math.round(speed * 3.6)} km/h`)
    }

    const deviceInfo = getDeviceInfo()

    const hasBlockingWarnings = spoofingWarnings.some((warning) =>
      warning.includes("punto nulo") || warning.includes("patron sospechoso")
    )

    const validatedLocation: ValidatedLocation = {
      latitude: rawLocation.coords.latitude,
      longitude: rawLocation.coords.longitude,
      accuracy,
      timestamp: rawLocation.timestamp,
      altitude: rawLocation.coords.altitude ?? undefined,
      speed: rawLocation.coords.speed ?? undefined,
      heading: rawLocation.coords.heading ?? undefined,
      isValid: !hasBlockingWarnings,
      validationWarnings: spoofingWarnings,
      deviceInfo,
    }

    if (hasBlockingWarnings) {
      return {
        success: false,
        error: "Ubicacion no valida. Asegurate de usar tu ubicacion real.",
        errorCode: "SPOOFING_DETECTED",
        location: validatedLocation,
      }
    }

    return {
      success: true,
      location: validatedLocation,
    }
  } catch (error) {
    console.error("Error getting location:", error)
    return {
      success: false,
      error: "Error al obtener ubicacion. Intenta de nuevo.",
      errorCode: "UNKNOWN",
    }
  }
}

export async function validateCheckInLocation(
  site: SiteCoordinates
): Promise<{
  canCheckIn: boolean
  error?: string
  location?: ValidatedLocation
  distanceMeters?: number
}> {
  if (!site.requiresGeolocation) {
    return {
      canCheckIn: true,
      location: undefined,
      distanceMeters: 0,
    }
  }

  const locationResult = await getValidatedLocation({
    maxAccuracyMeters: CHECKIN_POLICY.maxAccuracyMeters,
    samples: CHECKIN_POLICY.samples,
    timeoutMs: CHECKIN_POLICY.timeoutMs,
  })

  if (!locationResult.success || !locationResult.location) {
    return {
      canCheckIn: false,
      error: locationResult.error,
      location: locationResult.location,
    }
  }

  const effectiveRadius = Math.min(site.radiusMeters, CHECKIN_POLICY.radiusCapMeters)

  const distanceMeters = calculateDistance(
    locationResult.location.latitude,
    locationResult.location.longitude,
    site.latitude,
    site.longitude
  )

  const accuracy = locationResult.location.accuracy ?? 999

  // ✅ Regla estricta: solo aceptamos si estamos “confiablemente” dentro del radio
  // (si el GPS tiene 25m de error, no aceptamos un “estoy a 20m” sin margen)
  const isWithinStrict = distanceMeters + accuracy <= effectiveRadius

  if (!isWithinStrict) {
    const d = Math.round(distanceMeters)
    const a = Math.round(accuracy)
    return {
      canCheckIn: false,
      error: `Estás a ${d}m de ${site.name} (precisión GPS: ${a}m). Debes estar dentro de ${effectiveRadius}m con precisión suficiente.`,
      location: locationResult.location,
      distanceMeters: d,
    }
  }

  return {
    canCheckIn: true,
    location: locationResult.location,
    distanceMeters: Math.round(distanceMeters),
  }

}
