import { useCallback, useMemo, useRef, useState } from "react"
import * as Haptics from "expo-haptics"
import { Platform } from "react-native"

import { supabase } from "@/lib/supabase"
import {
  calculateDistance,
  validateCheckInLocation,
  type SiteCoordinates,
  type ValidatedLocation,
} from "@/lib/geolocation"
import { useAuth } from "@/contexts/auth-context"

function isLikelyOfflineError(err: unknown): boolean {
  if (!err) return false
  const anyErr = err as any
  const msg = String(anyErr?.message ?? anyErr).toLowerCase()

  if (msg.includes("network request failed")) return true
  if (msg.includes("failed to fetch")) return true
  if (msg.includes("load failed")) return true
  if (msg.includes("timeout")) return true
  if (msg.includes("etimedout")) return true
  if (msg.includes("enotfound")) return true
  if (msg.includes("econnrefused")) return true

  const status = anyErr?.status ?? anyErr?.statusCode
  if (status === 0) return true

  return false
}

export type AttendanceStatus = "not_checked_in" | "checked_in" | "checked_out"

export interface AttendanceState {
  status: AttendanceStatus
  lastCheckIn: string | null
  lastCheckOut: string | null
  todayHours: number
  currentSiteName: string | null
}

export interface CheckInOutResult {
  success: boolean
  error?: string
  timestamp?: string
}

export type GeofenceMode = "check_in" | "check_out"

export interface GeofenceCheckState {
  status: "idle" | "checking" | "ready" | "blocked" | "error"
  canProceed: boolean
  mode: GeofenceMode
  siteId: string | null
  siteName: string | null
  distanceMeters: number | null
  accuracyMeters: number | null
  effectiveRadiusMeters: number | null
  message: string | null
  updatedAt: number | null
  location: ValidatedLocation | null
  deviceInfo: Record<string, unknown> | null
}

const ATTENDANCE_GEOFENCE = {
  // Estricto pero usable:
  checkIn: { radiusCapMeters: 30, maxAccuracyMeters: 25 },
  checkOut: { radiusCapMeters: 40, maxAccuracyMeters: 30 },
}

function getAttendanceSource(): string {
  return Platform.OS === "web" ? "pwa" : "mobile"
}

function findBlockingGeoWarning(location?: ValidatedLocation): string | null {
  const warnings = location?.validationWarnings ?? []
  for (const w of warnings) {
    const s = w.toLowerCase()
    if (
      s.includes("punto nulo") ||
      s.includes("patron sospechoso") ||
      s.includes("digitos repetidos") ||
      s.includes("mock") ||
      s.includes("simulada") ||
      s.includes("spoof")
    ) {
      return w
    }
  }
  return null
}

function buildDeviceInfoPayload(
  location: ValidatedLocation | null,
  extra?: Record<string, unknown>
): Record<string, unknown> | null {
  if (!location) return null
  return {
    ...(location.deviceInfo as any),
    validationWarnings: location.validationWarnings ?? [],
    ...(extra ?? {}),
  }
}

export function useAttendance() {
  const { user, employee } = useAuth()

  const [attendanceState, setAttendanceState] = useState<AttendanceState>({
    status: "not_checked_in",
    lastCheckIn: null,
    lastCheckOut: null,
    todayHours: 0,
    currentSiteName: null,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const actionInFlightRef = useRef(false)
  const geofenceCacheRef = useRef<GeofenceCheckState | null>(null)

  const [geofenceState, setGeofenceState] = useState<GeofenceCheckState>({
    status: "idle",
    canProceed: false,
    mode: "check_in",
    siteId: null,
    siteName: null,
    distanceMeters: null,
    accuracyMeters: null,
    effectiveRadiusMeters: null,
    message: null,
    updatedAt: null,
    location: null,
    deviceInfo: null,
  })

  const getSiteCoordinates = useCallback(
    async (siteId?: string | null): Promise<SiteCoordinates | null> => {
      const id = siteId ?? employee?.siteId
      if (!id) return null

      const { data, error } = await supabase
        .from("sites")
        .select("id, name, latitude, longitude, checkin_radius_meters, type")
        .eq("id", id)
        .single()

      if (error || !data) return null

      const requiresGeo = data.type !== "vento_group" && data.latitude && data.longitude

      return {
        id: data.id,
        name: data.name,
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        radiusMeters: data.checkin_radius_meters || 50,
        requiresGeolocation: requiresGeo,
      }
    },
    [employee?.siteId]
  )

  const getLastAttendanceLog = useCallback(async (): Promise<{
    action: "check_in" | "check_out"
    occurred_at: string
    site_id: string
    site_name: string | null
  } | null> => {
    if (!user) return null

    const { data, error } = await supabase
      .from("attendance_logs")
      .select("action, occurred_at, site_id, sites(name)")
      .eq("employee_id", user.id)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    return {
      action: data.action,
      occurred_at: data.occurred_at,
      site_id: data.site_id,
      site_name: (data.sites as any)?.name ?? null,
    }
  }, [user])

  const loadTodayAttendance = useCallback(async () => {
    if (!user) {
      setIsOffline(false)
      setAttendanceState({
        status: "not_checked_in",
        lastCheckIn: null,
        lastCheckOut: null,
        todayHours: 0,
        currentSiteName: null,
      })
      return
    }

    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const [{ data: todayLogs, error: todayError }, lastLog] = await Promise.all([
      supabase
        .from("attendance_logs")
        .select("action, occurred_at, site_id, sites(name)")
        .eq("employee_id", user.id)
        .gte("occurred_at", start.toISOString())
        .lte("occurred_at", end.toISOString())
        .order("occurred_at", { ascending: true }),
      getLastAttendanceLog(),
    ])

    if (todayError) {
      console.error("Error loading attendance:", todayError)
      setIsOffline(isLikelyOfflineError(todayError))
      return
    }

    const logs = todayLogs ?? []
    const checkIns = logs.filter((l) => l.action === "check_in")
    const checkOuts = logs.filter((l) => l.action === "check_out")

    const lastTodayCheckIn = checkIns[checkIns.length - 1]
    const lastTodayCheckOut = checkOuts[checkOuts.length - 1]

    let totalMinutes = 0
    for (let i = 0; i < checkIns.length; i++) {
      const checkIn = new Date(checkIns[i].occurred_at)
      const checkOut = checkOuts[i]
        ? new Date(checkOuts[i].occurred_at)
        : i === checkIns.length - 1
          ? new Date()
          : checkIn

      totalMinutes += (checkOut.getTime() - checkIn.getTime()) / 60000
    }

    let status: AttendanceStatus = "not_checked_in"
    let currentSiteName: string | null = null
    let lastCheckIn: string | null = null
    let lastCheckOut: string | null = null

    if (lastLog?.action === "check_in") {
      status = "checked_in"
      currentSiteName = lastLog.site_name
      lastCheckIn = lastLog.occurred_at

      // si el check-in es previo a hoy, suma desde el inicio del día
      if (!lastTodayCheckIn) {
        const openStart = new Date(lastLog.occurred_at)
        const from = openStart.getTime() > start.getTime() ? openStart : start
        totalMinutes += (Date.now() - from.getTime()) / 60000
      }
    } else if (lastLog?.action === "check_out") {
      if (lastTodayCheckIn) {
        if (
          !lastTodayCheckOut ||
          new Date(lastTodayCheckIn.occurred_at) > new Date(lastTodayCheckOut.occurred_at)
        ) {
          status = "checked_in"
          currentSiteName = (lastTodayCheckIn.sites as any)?.name ?? null
        } else {
          status = "checked_out"
          currentSiteName = (lastTodayCheckIn.sites as any)?.name ?? null
        }
      } else {
        status = "not_checked_in"
      }
    }

    lastCheckIn = lastTodayCheckIn?.occurred_at ?? lastCheckIn
    lastCheckOut = lastTodayCheckOut?.occurred_at ?? null

    setAttendanceState({
      status,
      lastCheckIn,
      lastCheckOut,
      todayHours: Math.round((totalMinutes / 60) * 10) / 10,
      currentSiteName,
    })
    setIsOffline(false)
  }, [user, getLastAttendanceLog])

  const refreshGeofence = useCallback(
    async (args?: { force?: boolean; mode?: GeofenceMode; siteId?: string | null }) => {
      const now = Date.now()

      if (!user || !employee) {
        const next: GeofenceCheckState = {
          status: "error",
          canProceed: false,
          mode: args?.mode ?? "check_in",
          siteId: args?.siteId ?? null,
          siteName: null,
          distanceMeters: null,
          accuracyMeters: null,
          effectiveRadiusMeters: null,
          message: "No autenticado",
          updatedAt: now,
          location: null,
          deviceInfo: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      let mode: GeofenceMode
      let siteId: string | null

      if (args?.mode && args?.siteId) {
        mode = args.mode
        siteId = args.siteId
      } else {
        const lastLog = await getLastAttendanceLog()
        if (lastLog?.action === "check_in") {
          mode = "check_out"
          siteId = lastLog.site_id
        } else {
          mode = "check_in"
          siteId = employee.siteId ?? null
        }
      }

      if (!siteId) {
        const next: GeofenceCheckState = {
          status: "blocked",
          canProceed: false,
          mode,
          siteId: null,
          siteName: null,
          distanceMeters: null,
          accuracyMeters: null,
          effectiveRadiusMeters: null,
          message: "No tienes sede asignada",
          updatedAt: now,
          location: null,
          deviceInfo: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const cached = geofenceCacheRef.current
      const canReuse =
        !args?.force &&
        cached &&
        cached.status === "ready" &&
        cached.canProceed &&
        cached.mode === mode &&
        cached.siteId === siteId &&
        cached.updatedAt != null &&
        now - cached.updatedAt <= 20000

      if (canReuse) return cached

      setGeofenceState((prev) => ({
        ...prev,
        status: "checking",
        canProceed: false,
        mode,
        siteId,
        message: "Verificando ubicación…",
        updatedAt: now,
      }))

      const site = await getSiteCoordinates(siteId)
      if (!site) {
        const next: GeofenceCheckState = {
          status: "error",
          canProceed: false,
          mode,
          siteId,
          siteName: null,
          distanceMeters: null,
          accuracyMeters: null,
          effectiveRadiusMeters: null,
          message: "No se pudo cargar la sede para verificar ubicación",
          updatedAt: now,
          location: null,
          deviceInfo: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      if (!site.requiresGeolocation) {
        const next: GeofenceCheckState = {
          status: "ready",
          canProceed: true,
          mode,
          siteId: site.id,
          siteName: site.name,
          distanceMeters: 0,
          accuracyMeters: null,
          effectiveRadiusMeters: null,
          message: "Esta sede no requiere GPS",
          updatedAt: now,
          location: null,
          deviceInfo: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const policy = mode === "check_out" ? ATTENDANCE_GEOFENCE.checkOut : ATTENDANCE_GEOFENCE.checkIn
      const effectiveRadius = Math.min(site.radiusMeters, policy.radiusCapMeters)

      const base = await validateCheckInLocation({ ...site, radiusMeters: effectiveRadius })

      const location = base.location ?? null
      const accuracy = location?.accuracy ?? null

      // distancia real (no redondeada)
      const distanceRaw =
        location != null
          ? calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude)
          : null
      const distanceMeters = distanceRaw != null ? Math.round(distanceRaw) : null

      if (!base.canCheckIn) {
        const next: GeofenceCheckState = {
          status: "blocked",
          canProceed: false,
          mode,
          siteId: site.id,
          siteName: site.name,
          distanceMeters,
          accuracyMeters: accuracy,
          effectiveRadiusMeters: effectiveRadius,
          message: base.error || "Ubicación fuera de rango",
          updatedAt: now,
          location,
          deviceInfo: buildDeviceInfoPayload(location, {
            geofence: {
              distanceMeters,
              effectiveRadiusMeters: effectiveRadius,
              maxAccuracyMeters: policy.maxAccuracyMeters,
            },
          }),
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      if (!location) {
        const next: GeofenceCheckState = {
          status: "error",
          canProceed: false,
          mode,
          siteId: site.id,
          siteName: site.name,
          distanceMeters: null,
          accuracyMeters: null,
          effectiveRadiusMeters: effectiveRadius,
          message: "Ubicación requerida para continuar",
          updatedAt: now,
          location: null,
          deviceInfo: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const blocking = findBlockingGeoWarning(location)
      if (blocking) {
        const next: GeofenceCheckState = {
          status: "blocked",
          canProceed: false,
          mode,
          siteId: site.id,
          siteName: site.name,
          distanceMeters,
          accuracyMeters: accuracy,
          effectiveRadiusMeters: effectiveRadius,
          message: `Ubicación no válida: ${blocking}. Desactiva ubicaciones simuladas y vuelve a intentar.`,
          updatedAt: now,
          location,
          deviceInfo: buildDeviceInfoPayload(location, {
            geofence: {
              distanceMeters,
              effectiveRadiusMeters: effectiveRadius,
              maxAccuracyMeters: policy.maxAccuracyMeters,
            },
          }),
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const acc = location.accuracy ?? 999
      if (acc > policy.maxAccuracyMeters) {
        const next: GeofenceCheckState = {
          status: "blocked",
          canProceed: false,
          mode,
          siteId: site.id,
          siteName: site.name,
          distanceMeters,
          accuracyMeters: acc,
          effectiveRadiusMeters: effectiveRadius,
          message: `Precisión GPS insuficiente (${Math.round(acc)}m). Acércate a una ventana y vuelve a intentar.`,
          updatedAt: now,
          location,
          deviceInfo: buildDeviceInfoPayload(location, {
            geofence: {
              distanceMeters,
              effectiveRadiusMeters: effectiveRadius,
              maxAccuracyMeters: policy.maxAccuracyMeters,
            },
          }),
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const distance = distanceRaw ?? 999999
      // regla estricta de confianza: distancia + precisión <= radio
      if (distance + acc > effectiveRadius) {
        const next: GeofenceCheckState = {
          status: "blocked",
          canProceed: false,
          mode,
          siteId: site.id,
          siteName: site.name,
          distanceMeters: Math.round(distance),
          accuracyMeters: acc,
          effectiveRadiusMeters: effectiveRadius,
          message: `Estás a ${Math.round(distance)}m (precisión ${Math.round(
            acc
          )}m). Debes estar dentro de ${effectiveRadius}m con señal suficiente.`,
          updatedAt: now,
          location,
          deviceInfo: buildDeviceInfoPayload(location, {
            geofence: {
              distanceMeters: Math.round(distance),
              effectiveRadiusMeters: effectiveRadius,
              maxAccuracyMeters: policy.maxAccuracyMeters,
            },
          }),
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const next: GeofenceCheckState = {
        status: "ready",
        canProceed: true,
        mode,
        siteId: site.id,
        siteName: site.name,
        distanceMeters: Math.round(distance),
        accuracyMeters: acc,
        effectiveRadiusMeters: effectiveRadius,
        message: "Ubicación verificada",
        updatedAt: now,
        location,
        deviceInfo: buildDeviceInfoPayload(location, {
          geofence: {
            distanceMeters: Math.round(distance),
            effectiveRadiusMeters: effectiveRadius,
            maxAccuracyMeters: policy.maxAccuracyMeters,
          },
        }),
      }

      geofenceCacheRef.current = next
      setGeofenceState(next)
      return next
    },
    [user, employee, getLastAttendanceLog, getSiteCoordinates]
  )

  const checkIn = useCallback(async (): Promise<CheckInOutResult> => {
    if (!user || !employee) return { success: false, error: "No autenticado" }
    if (!employee.isActive) return { success: false, error: "Tu cuenta esta inactiva" }
    if (!employee.siteId) return { success: false, error: "No tienes sede asignada" }

    const lastLog = await getLastAttendanceLog()
    if (lastLog?.action === "check_in") {
      return { success: false, error: "Ya tienes un check-in activo" }
    }

    if (actionInFlightRef.current) return { success: false, error: "Acción en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)

    try {
      const geo = await refreshGeofence({ force: true, mode: "check_in", siteId: employee.siteId })
      if (!geo.canProceed) {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        }
        return { success: false, error: geo.message || "Ubicación no verificada" }
      }

      const location = geo.location
      const deviceInfo = geo.deviceInfo

      const { error } = await supabase.from("attendance_logs").insert({
        employee_id: user.id,
        site_id: employee.siteId,
        action: "check_in",
        source: getAttendanceSource(),
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy_meters: location?.accuracy ?? null,
        device_info: deviceInfo,
        notes: null,
      })

      if (error) throw error

      setIsOffline(false)

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }

      await loadTodayAttendance()

      return { success: true, timestamp: new Date().toISOString() }
    } catch (err) {
      console.error("Check-in error:", err)
      const offline = isLikelyOfflineError(err)
      setIsOffline(offline)
      return {
        success: false,
        error: offline ? "Sin conexion. Intenta de nuevo." : "Error al registrar entrada",
      }
    } finally {
      actionInFlightRef.current = false
      setIsLoading(false)
    }
  }, [user, employee, getLastAttendanceLog, refreshGeofence, loadTodayAttendance])

  const checkOut = useCallback(async (): Promise<CheckInOutResult> => {
    if (!user || !employee) return { success: false, error: "No autenticado" }
    if (!employee.isActive) return { success: false, error: "Tu cuenta esta inactiva" }

    const lastLog = await getLastAttendanceLog()
    if (!lastLog || lastLog.action !== "check_in") {
      return { success: false, error: "No hay check-in activo" }
    }

    if (actionInFlightRef.current) return { success: false, error: "Acción en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)

    try {
      const siteIdToClose = lastLog.site_id

      const geo = await refreshGeofence({ force: true, mode: "check_out", siteId: siteIdToClose })
      if (!geo.canProceed) {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        }
        return { success: false, error: geo.message || "Ubicación no verificada" }
      }

      const location = geo.location
      const deviceInfo = geo.deviceInfo

      const { error } = await supabase.from("attendance_logs").insert({
        employee_id: user.id,
        site_id: siteIdToClose, // ✅ cierra la sede del turno abierto
        action: "check_out",
        source: getAttendanceSource(),
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy_meters: location?.accuracy ?? null,
        device_info: deviceInfo,
        notes: null,
      })

      if (error) throw error

      setIsOffline(false)

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }

      await loadTodayAttendance()

      return { success: true, timestamp: new Date().toISOString() }
    } catch (err) {
      console.error("Check-out error:", err)
      const offline = isLikelyOfflineError(err)
      setIsOffline(offline)
      return {
        success: false,
        error: offline ? "Sin conexion. Intenta de nuevo." : "Error al registrar salida",
      }
    } finally {
      actionInFlightRef.current = false
      setIsLoading(false)
    }
  }, [user, employee, getLastAttendanceLog, refreshGeofence, loadTodayAttendance])

  return {
    attendanceState,
    geofenceState,
    refreshGeofence,
    isLoading,
    isOffline,
    loadTodayAttendance,
    checkIn,
    checkOut,
  }
}
