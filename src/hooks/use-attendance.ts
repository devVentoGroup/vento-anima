import { useCallback, useEffect, useRef, useState } from "react"
import * as Haptics from "expo-haptics"
import * as Location from "expo-location"

import { supabase } from "@/lib/supabase"
import {
  buildValidatedLocationFromRaw,
  calculateDistance,
  getValidatedLocation,
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
function getAttendanceErrorMessage(
  err: unknown,
  action: "check_in" | "check_out"
): string | null {
  if (!err) return null
  const anyErr = err as any
  const code = String(anyErr?.code ?? "")
  const message = String(anyErr?.message ?? "")
  const details = String(anyErr?.details ?? "")
  const hint = String(anyErr?.hint ?? "")
  const combined = `${message} ${details} ${hint}`.toLowerCase()

  const mentionsAssigned = combined.includes("asignada") || combined.includes("asignado")
  const mentionsSite = combined.includes("sede")
  const mentionsAuth = combined.includes("no autorizado") || combined.includes("no autorizada")
  const mentionsCheckIn = combined.includes("check-in") || combined.includes("check in")

  if (
    code === "P0001" &&
    action === "check_in" &&
    ((mentionsAssigned && mentionsSite) || (mentionsAuth && mentionsCheckIn))
  ) {
    return "No tienes asignada esta sede."
  }

  return null
}

function isNoActiveBreakError(err: unknown): boolean {
  if (!err) return false
  const anyErr = err as any
  const message = String(anyErr?.message ?? "").toLowerCase()
  return message.includes("no hay descanso activo")
}

export type AttendanceStatus = "not_checked_in" | "checked_in" | "checked_out"

export interface AttendanceState {
  status: AttendanceStatus
  lastCheckIn: string | null
  lastCheckOut: string | null
  lastCheckOutSource: string | null
  lastCheckOutNotes: string | null
  todayMinutes: number
  todayBreakMinutes: number
  isOnBreak: boolean
  openBreakStartAt: string | null
  snapshotAt: string | null
  openStartAt: string | null
  currentSiteName: string | null
}

export interface CheckInOutResult {
  success: boolean
  error?: string
  timestamp?: string
}

export type GeofenceMode = "check_in" | "check_out"

export interface SiteCandidate {
  id: string
  name: string
  distanceMeters: number
  effectiveRadiusMeters: number
  requiresGeolocation: boolean
}

export interface GeofenceCheckState {
  status: "idle" | "checking" | "ready" | "blocked" | "error"
  canProceed: boolean
  mode: GeofenceMode
  lastUpdateSource?: "auto" | "user" | "check_action"
  siteId: string | null
  siteName: string | null
  distanceMeters: number | null
  accuracyMeters: number | null
  effectiveRadiusMeters: number | null
  message: string | null
  updatedAt: number | null
  location: ValidatedLocation | null
  deviceInfo: Record<string, unknown> | null
  requiresSelection: boolean
  candidateSites: SiteCandidate[] | null
}

type AttendanceLogRow = {
  action: "check_in" | "check_out"
  occurred_at: string
  site_id: string
  source?: string | null
  notes?: string | null
  sites?: { name: string | null } | { name: string | null }[] | null
}

type AttendanceBreakRow = {
  started_at: string
  ended_at: string | null
}

const ATTENDANCE_GEOFENCE = {
  // Debe coincidir con la validacion del trigger en BD
  checkIn: { maxAccuracyMeters: 20 },
  checkOut: { maxAccuracyMeters: 25 },
}

const SHIFT_DEPARTURE_TRACKING = {
  thresholdMeters: 100,
  maxAccuracyMeters: 35,
  minCheckIntervalMs: 45000,
}

function getAttendanceSource(): string {
  return "mobile"
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

function asMillis(value: string): number {
  return new Date(value).getTime()
}

function getOverlapMinutes(
  intervalStartMs: number,
  intervalEndMs: number,
  breaks: Array<{ startMs: number; endMs: number }>
): number {
  if (intervalEndMs <= intervalStartMs) return 0
  let total = 0
  for (const item of breaks) {
    const overlapStart = Math.max(intervalStartMs, item.startMs)
    const overlapEnd = Math.min(intervalEndMs, item.endMs)
    if (overlapEnd > overlapStart) {
      total += (overlapEnd - overlapStart) / 60000
    }
  }
  return total
}

export function useAttendance() {
  const { user, employee, employeeSites, selectedSiteId, setSelectedSite } = useAuth()

  const [attendanceState, setAttendanceState] = useState<AttendanceState>({
    status: "not_checked_in",
    lastCheckIn: null,
    lastCheckOut: null,
    lastCheckOutSource: null,
    lastCheckOutNotes: null,
    todayMinutes: 0,
    todayBreakMinutes: 0,
    isOnBreak: false,
    openBreakStartAt: null,
    snapshotAt: null,
    openStartAt: null,
    currentSiteName: null,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const actionInFlightRef = useRef(false)
  const realtimeWatchRef = useRef<Location.LocationSubscription | null>(null)
  const lastRealtimeTickRef = useRef(0)
  const geofenceCacheRef = useRef<GeofenceCheckState | null>(null)
  const departureEventInFlightRef = useRef(false)
  const departureLastCheckAtRef = useRef(0)
  const departureLoggedShiftKeyRef = useRef<string | null>(null)

  const [geofenceState, setGeofenceState] = useState<GeofenceCheckState>({
    status: "idle",
    canProceed: false,
    mode: "check_in",
    lastUpdateSource: "user",
    siteId: null,
    siteName: null,
    distanceMeters: null,
    accuracyMeters: null,
    effectiveRadiusMeters: null,
    message: null,
    updatedAt: null,
    location: null,
    deviceInfo: null,
    requiresSelection: false,
    candidateSites: null,
  })

  useEffect(() => {
    if (attendanceState.status !== "checked_in") {
      departureLoggedShiftKeyRef.current = null
    }
  }, [attendanceState.status])

  const resolveSite = useCallback(
    async (siteId: string): Promise<{ site: SiteCoordinates | null; hasCoordinates: boolean }> => {
      // SIEMPRE obtener coordenadas frescas de la BD para evitar usar datos en caché desactualizados
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, latitude, longitude, checkin_radius_meters, type")
        .eq("id", siteId)
        .single()

      if (error || !data) {
        console.error('[resolveSite] Error obteniendo sede de BD:', error)
        // Fallback a la caché solo si falla la BD
        const fromList = employeeSites.find((item) => item.siteId === siteId)
        if (fromList) {
          console.warn('[resolveSite] Usando datos en caché como fallback')
          const hasCoordinates = fromList.latitude != null && fromList.longitude != null
          const requiresGeolocation = hasCoordinates // Si tiene coordenadas, requiere geo
          return {
            site: {
              id: fromList.siteId,
              name: fromList.siteName,
              latitude: fromList.latitude ?? 0,
              longitude: fromList.longitude ?? 0,
              radiusMeters: fromList.radiusMeters ?? 0,
              requiresGeolocation,
            },
            hasCoordinates,
          }
        }
        return { site: null, hasCoordinates: false }
      }

      const hasCoordinates = data.latitude != null && data.longitude != null
      const requiresGeolocation = hasCoordinates // Si tiene coordenadas, requiere geo

      return {
        site: {
          id: data.id,
          name: data.name,
          latitude: data.latitude ?? 0,
          longitude: data.longitude ?? 0,
          radiusMeters: data.checkin_radius_meters ?? 0,
          requiresGeolocation,
        },
        hasCoordinates,
      }
    },
    [employeeSites]
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
        lastCheckOutSource: null,
        lastCheckOutNotes: null,
        todayMinutes: 0,
        todayBreakMinutes: 0,
        isOnBreak: false,
        openBreakStartAt: null,
        snapshotAt: null,
        openStartAt: null,
        currentSiteName: null,
      })
      return
    }

    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const nowMs = Date.now()
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const [
      { data: todayLogs, error: todayError },
      { data: todayBreaks, error: breakError },
      lastLog,
    ] = await Promise.all([
      supabase
        .from("attendance_logs")
        .select("action, occurred_at, site_id, source, notes, device_info, sites(name)")
        .eq("employee_id", user.id)
        .gte("occurred_at", startIso)
        .lte("occurred_at", endIso)
        .order("occurred_at", { ascending: true }),
      supabase
        .from("attendance_breaks")
        .select("started_at, ended_at")
        .eq("employee_id", user.id)
        .lte("started_at", endIso)
        .or(`ended_at.is.null,ended_at.gte.${startIso}`)
        .order("started_at", { ascending: true }),
      getLastAttendanceLog(),
    ])

    if (todayError || breakError) {
      console.error("Error loading attendance:", todayError ?? breakError)
      setIsOffline(isLikelyOfflineError(todayError ?? breakError))
      return
    }

    const logs = ((todayLogs ?? []) as AttendanceLogRow[]).sort((a, b) =>
      a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0
    )
    const breaks = (todayBreaks ?? []) as AttendanceBreakRow[]
    const checkIns = logs.filter((l) => l.action === "check_in")
    const checkOuts = logs.filter((l) => l.action === "check_out")

    const lastTodayCheckIn = checkIns[checkIns.length - 1]
    const lastTodayCheckOut = checkOuts[checkOuts.length - 1]

    let status: AttendanceStatus = "not_checked_in"
    let currentSiteName: string | null = null
    let lastCheckIn: string | null = null
    let lastCheckOut: string | null = null
    let openStartAt: string | null = null

    if (lastLog?.action === "check_in") {
      status = "checked_in"
      currentSiteName = lastLog.site_name
      lastCheckIn = lastLog.occurred_at

      if (lastTodayCheckIn) {
        openStartAt = lastTodayCheckIn.occurred_at
      }

      if (!openStartAt && !lastTodayCheckIn) {
        const openStart = asMillis(lastLog.occurred_at)
        const from = openStart > start.getTime() ? openStart : start.getTime()
        openStartAt = new Date(from).toISOString()
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
    const lastCheckOutSource = (lastTodayCheckOut as any)?.source ?? null
    const lastCheckOutNotes = (lastTodayCheckOut as any)?.notes ?? null

    const breakIntervals = breaks
      .map((item) => {
        const startMs = Math.max(asMillis(item.started_at), start.getTime())
        const endMsRaw = item.ended_at ? asMillis(item.ended_at) : nowMs
        const endMs = Math.min(endMsRaw, nowMs)
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
        return { startMs, endMs }
      })
      .filter(Boolean) as Array<{ startMs: number; endMs: number }>

    const openBreak = [...breaks]
      .reverse()
      .find((item) => item.ended_at == null)
    const isOnBreak = status === "checked_in" && !!openBreak
    const openBreakStartAt = isOnBreak ? openBreak?.started_at ?? null : null

    const shiftIntervals: Array<{ startMs: number; endMs: number }> = []
    let pendingStartMs: number | null = null

    for (const log of logs) {
      if (log.action === "check_in") {
        pendingStartMs = asMillis(log.occurred_at)
        continue
      }
      if (log.action === "check_out" && pendingStartMs != null) {
        const endMs = asMillis(log.occurred_at)
        if (endMs > pendingStartMs) {
          shiftIntervals.push({ startMs: pendingStartMs, endMs })
        }
        pendingStartMs = null
      }
    }

    if (status === "checked_in") {
      if (pendingStartMs != null && nowMs > pendingStartMs) {
        shiftIntervals.push({ startMs: pendingStartMs, endMs: nowMs })
      } else if (pendingStartMs == null && openStartAt) {
        const openStartMs = asMillis(openStartAt)
        if (nowMs > openStartMs) {
          shiftIntervals.push({ startMs: openStartMs, endMs: nowMs })
        }
      }
    }

    let grossMinutesRaw = 0
    let breakMinutesRaw = 0
    for (const interval of shiftIntervals) {
      grossMinutesRaw += (interval.endMs - interval.startMs) / 60000
      breakMinutesRaw += getOverlapMinutes(interval.startMs, interval.endMs, breakIntervals)
    }
    const netMinutes = Math.max(0, Math.round(grossMinutesRaw - breakMinutesRaw))
    const todayBreakMinutes = Math.max(0, Math.round(breakMinutesRaw))

    setAttendanceState({
      status,
      lastCheckIn,
      lastCheckOut,
      lastCheckOutSource,
      lastCheckOutNotes,
      todayMinutes: netMinutes,
      todayBreakMinutes,
      isOnBreak,
      openBreakStartAt,
      snapshotAt: new Date(nowMs).toISOString(),
      openStartAt,
      currentSiteName,
    })
    setIsOffline(false)
  }, [user, getLastAttendanceLog])

  const refreshGeofence = useCallback(
    async (args?: {
      force?: boolean
      mode?: GeofenceMode
      siteId?: string | null
      location?: ValidatedLocation | null
      silent?: boolean
      source?: "auto" | "user" | "check_action"
    }) => {
      const now = Date.now()
      const isSilentRefresh = args?.silent === true
      const updateSource = args?.source ?? "user"

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
          requiresSelection: false,
          candidateSites: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      let mode: GeofenceMode
      let siteId: string | null = null
      let location: ValidatedLocation | null = args?.location ?? null

      if (location && now - location.timestamp > 30000) {
        location = null
      }

      const lastLog = args?.mode ? null : await getLastAttendanceLog()
      mode = args?.mode ?? (lastLog?.action === "check_in" ? "check_out" : "check_in")

      const policy = mode === "check_out" ? ATTENDANCE_GEOFENCE.checkOut : ATTENDANCE_GEOFENCE.checkIn

            // Filtrar sedes: si tiene coordenadas, usa GPS; si no, no requiere GPS
      const assignedGeoSites = employeeSites.filter((item) =>
        item.latitude != null && item.longitude != null
      )
      const assignedNonGeoSites = employeeSites.filter((item) =>
        item.latitude == null || item.longitude == null
      )

      const selectedSiteIsValid =
        selectedSiteId != null && employeeSites.some((item) => item.siteId === selectedSiteId)
      const effectiveSelectedSiteId = selectedSiteIsValid ? selectedSiteId : null

      const buildSelectionCandidates = (baseLocation: ValidatedLocation | null): SiteCandidate[] =>
        employeeSites.map((item) => {
          const effectiveRadius = Number(item.radiusMeters ?? 0)
          const hasCoordinates = item.latitude != null && item.longitude != null
          const distance =
            baseLocation && hasCoordinates
              ? Math.round(
                  calculateDistance(
                    baseLocation.latitude,
                    baseLocation.longitude,
                    item.latitude as number,
                    item.longitude as number
                  )
                )
              : 0

          return {
            id: item.siteId,
            name: item.siteName,
            distanceMeters: distance,
            effectiveRadiusMeters: effectiveRadius,
            requiresGeolocation: hasCoordinates,
          }
        })

      if (mode === "check_out") {
        // Check-out siempre usa la sede del ultimo check-in abierto.
        siteId = args?.siteId ?? lastLog?.site_id ?? null
      } else {
        // Check-in: en multi-sede siempre se exige seleccion explicita.
        if (args?.siteId) {
          siteId = args.siteId
        } else if (employeeSites.length > 1) {
          if (effectiveSelectedSiteId) {
            siteId = effectiveSelectedSiteId
          } else {
            const next: GeofenceCheckState = {
              status: "blocked",
              canProceed: false,
              mode,
              lastUpdateSource: updateSource,
              siteId: null,
              siteName: null,
              distanceMeters: null,
              accuracyMeters: location?.accuracy ?? null,
              effectiveRadiusMeters: null,
              message: "Selecciona una sede para continuar",
              updatedAt: now,
              location: location ?? null,
              deviceInfo: buildDeviceInfoPayload(location ?? null),
              requiresSelection: true,
              candidateSites: buildSelectionCandidates(location ?? null),
            }
            geofenceCacheRef.current = next
            setGeofenceState(next)
            return next
          }
        } else if (employeeSites.length === 1) {
          siteId = employeeSites[0].siteId
        } else if (assignedGeoSites.length === 1) {
          siteId = assignedGeoSites[0].siteId
        } else if (assignedNonGeoSites.length === 1) {
          siteId = assignedNonGeoSites[0].siteId
        }
      }

      if (!siteId) {
        const next: GeofenceCheckState = {
          status: "blocked",
          canProceed: false,
          mode,
          lastUpdateSource: updateSource,
          siteId: null,
          siteName: null,
          distanceMeters: null,
          accuracyMeters: null,
          effectiveRadiusMeters: null,
          message: "No tienes sede asignada",
          updatedAt: now,
          location: null,
          deviceInfo: null,
          requiresSelection: false,
          candidateSites: null,
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
        !cached.requiresSelection &&
        cached.mode === mode &&
        cached.siteId === siteId &&
        cached.updatedAt != null &&
        now - cached.updatedAt <= 20000

      if (canReuse) return cached

      if (!isSilentRefresh) {
        setGeofenceState((prev) => ({
          ...prev,
          status: "checking",
          canProceed: false,
          mode,
          lastUpdateSource: updateSource,
          siteId,
          message: "Verificando ubicación...",
          updatedAt: now,
          requiresSelection: false,
          candidateSites: null,
        }))
      }

      try {
        const resolved = await resolveSite(siteId)
      if (!resolved.site) {
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
          requiresSelection: false,
          candidateSites: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const site = resolved.site
      if (site.requiresGeolocation && !resolved.hasCoordinates) {
        const next: GeofenceCheckState = {
          status: "error",
          canProceed: false,
          mode,
          siteId: site.id,
          siteName: site.name,
          distanceMeters: null,
          accuracyMeters: null,
          effectiveRadiusMeters: null,
          message: "La sede no tiene coordenadas configuradas",
          updatedAt: now,
          location: null,
          deviceInfo: null,
          requiresSelection: false,
          candidateSites: null,
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
          requiresSelection: false,
          candidateSites: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const effectiveRadius = Number(site.radiusMeters ?? 0)
      if (!Number.isFinite(effectiveRadius) || effectiveRadius <= 0) {
        const next: GeofenceCheckState = {
          status: "error",
          canProceed: false,
          mode,
          siteId: site.id,
          siteName: site.name,
          distanceMeters: null,
          accuracyMeters: null,
          effectiveRadiusMeters: null,
          message: "La sede no tiene radio de check-in configurado",
          updatedAt: now,
          location: null,
          deviceInfo: null,
          requiresSelection: false,
          candidateSites: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      if (!location) {
        const locationResult = await getValidatedLocation({
          maxAccuracyMeters: policy.maxAccuracyMeters,
          samples: mode === "check_out" ? 3 : 4,
          timeoutMs: 20000,
        })
        if (!locationResult.success || !locationResult.location) {
          const next: GeofenceCheckState = {
            status: "blocked",
            canProceed: false,
            mode,
            siteId: site.id,
            siteName: site.name,
            distanceMeters: null,
            accuracyMeters: null,
            effectiveRadiusMeters: effectiveRadius,
            message: locationResult.error || "Ubicación requerida para continuar",
            updatedAt: now,
            location: locationResult.location ?? null,
            deviceInfo: buildDeviceInfoPayload(locationResult.location ?? null),
            requiresSelection: false,
            candidateSites: null,
          }
          geofenceCacheRef.current = next
          setGeofenceState(next)
          return next
        }
        location = locationResult.location
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
          requiresSelection: false,
          candidateSites: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const distanceRaw = calculateDistance(
        location.latitude,
        location.longitude,
        site.latitude,
        site.longitude
      )
      const distanceMeters = Math.round(distanceRaw)

      const blocking = findBlockingGeoWarning(location)
      if (blocking) {
        const next: GeofenceCheckState = {
          status: "blocked",
          canProceed: false,
          mode,
          siteId: site.id,
          siteName: site.name,
          distanceMeters,
          accuracyMeters: location.accuracy ?? null,
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
          requiresSelection: false,
          candidateSites: null,
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
          message: `Precision GPS insuficiente (${Math.round(acc)}m). Acercate a una ventana y vuelve a intentar.`,
          updatedAt: now,
          location,
          deviceInfo: buildDeviceInfoPayload(location, {
            geofence: {
              distanceMeters,
              effectiveRadiusMeters: effectiveRadius,
              maxAccuracyMeters: policy.maxAccuracyMeters,
            },
          }),
          requiresSelection: false,
          candidateSites: null,
        }
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const distance = distanceRaw ?? 999999
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
          requiresSelection: false,
          candidateSites: null,
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
        requiresSelection: false,
        candidateSites: null,
      }

      geofenceCacheRef.current = next
      setGeofenceState(next)
      return next

      } catch (error) {
        // Catch-all para evitar que se quede en "checking" para siempre
        console.error('[refreshGeofence] Error no manejado:', error)
        const errorState: GeofenceCheckState = {
          status: "error",
          canProceed: false,
          mode,
          siteId: siteId ?? null,
          siteName: null,
          distanceMeters: null,
          accuracyMeters: null,
          effectiveRadiusMeters: null,
          message: "Error al verificar ubicación. Intenta de nuevo.",
          updatedAt: Date.now(),
          location: null,
          deviceInfo: null,
          requiresSelection: false,
          candidateSites: null,
        }
        geofenceCacheRef.current = errorState
        setGeofenceState(errorState)
        return errorState
      }
    },
    [user, employee, employeeSites, selectedSiteId, getLastAttendanceLog, resolveSite]
  )

  const checkIn = useCallback(async (): Promise<CheckInOutResult> => {
    if (!user || !employee) return { success: false, error: "No autenticado" }
    if (!employee.isActive) return { success: false, error: "Tu cuenta está inactiva" }

    const lastLog = await getLastAttendanceLog()
    if (lastLog?.action === "check_in") {
      return { success: false, error: "Ya tienes un check-in activo" }
    }

    if (actionInFlightRef.current) return { success: false, error: "Acción en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)

    try {
      // Asegurar que el geofence esté listo antes de proceder
      // En producción, el geofence puede tardar más en verificarse
      let geo = await refreshGeofence({ force: true, mode: "check_in", source: "check_action" })
      
      // Si el geofence está "checking" o no está listo, esperar hasta que esté listo (máximo 8 segundos)
      const maxWait = 8000
      const startTime = Date.now()
      let attempts = 0
      const maxAttempts = 4
      
      while ((geo.status === "checking" || !geo.canProceed) && 
             (Date.now() - startTime) < maxWait && 
             attempts < maxAttempts &&
             geo.status !== "blocked" && 
             geo.status !== "error") {
        console.log(`[CHECKIN] Geofence not ready (${geo.status}), waiting... (attempt ${attempts + 1}/${maxAttempts})`)
        await new Promise(resolve => setTimeout(resolve, 1500)) // Esperar 1.5 segundos entre intentos
        geo = await refreshGeofence({ force: true, mode: "check_in", source: "check_action" })
        attempts++
        
        // Si ya está listo, salir del loop
        if (geo.canProceed && geo.status === "ready") break
      }
      
      if (!geo.canProceed) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        const errorMsg = geo.status === "checking" 
          ? "La verificación de ubicación está tardando demasiado. Intenta de nuevo."
          : (geo.message || "Ubicación no verificada")
        return { success: false, error: errorMsg }
      }

      if (!geo.siteId) {
        return { success: false, error: "No se pudo determinar la sede" }
      }

      const location = geo.location
      const deviceInfo = geo.deviceInfo

      const { error } = await supabase.from("attendance_logs").insert({
        employee_id: user.id,
        site_id: geo.siteId,
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      await loadTodayAttendance()

      return { success: true, timestamp: new Date().toISOString() }
    } catch (err) {
      const offline = isLikelyOfflineError(err)
      const friendly = !offline ? getAttendanceErrorMessage(err, "check_in") : null
      if (friendly) {
        console.warn("Check-in blocked:", friendly, err)
      } else {
        console.error("Check-in error:", err)
      }
      setIsOffline(offline)
      return {
        success: false,
        error: offline
          ? "Sin conexión. Intenta de nuevo."
          : friendly ?? "Error al registrar entrada",
      }
    } finally {
      actionInFlightRef.current = false
      setIsLoading(false)
    }
  }, [user, employee, getLastAttendanceLog, refreshGeofence, loadTodayAttendance])

  const checkOut = useCallback(async (): Promise<CheckInOutResult> => {
    if (!user || !employee) return { success: false, error: "No autenticado" }
    if (!employee.isActive) return { success: false, error: "Tu cuenta está inactiva" }

    const lastLog = await getLastAttendanceLog()
    if (!lastLog || lastLog.action !== "check_in") {
      return { success: false, error: "No hay check-in activo" }
    }

    if (actionInFlightRef.current) return { success: false, error: "Acción en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)

    try {
      const siteIdToClose = lastLog.site_id

      const geo = await refreshGeofence({
        force: true,
        mode: "check_out",
        siteId: siteIdToClose,
        source: "check_action",
      })
      if (!geo.canProceed) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return { success: false, error: geo.message || "Ubicación no verificada" }
      }

      if (attendanceState.isOnBreak || attendanceState.openBreakStartAt) {
        const { error: breakCloseError } = await supabase.rpc("end_attendance_break", {
          p_source: getAttendanceSource(),
          p_notes: "Cierre automático por check-out",
        })
        if (breakCloseError && !isNoActiveBreakError(breakCloseError)) {
          throw breakCloseError
        }
      }

      const location = geo.location
      const deviceInfo = geo.deviceInfo

      const { error } = await supabase.from("attendance_logs").insert({
        employee_id: user.id,
        site_id: siteIdToClose,
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      await loadTodayAttendance()

      return { success: true, timestamp: new Date().toISOString() }
    } catch (err) {
      const offline = isLikelyOfflineError(err)
      const friendly = !offline ? getAttendanceErrorMessage(err, "check_out") : null
      if (friendly) {
        console.warn("Check-out blocked:", friendly, err)
      } else {
        console.error("Check-out error:", err)
      }
      setIsOffline(offline)
      return {
        success: false,
        error: offline
          ? "Sin conexión. Intenta de nuevo."
          : friendly ?? "Error al registrar salida",
      }
    } finally {
      actionInFlightRef.current = false
      setIsLoading(false)
    }
  }, [
    user,
    employee,
    getLastAttendanceLog,
    refreshGeofence,
    loadTodayAttendance,
    attendanceState.isOnBreak,
    attendanceState.openBreakStartAt,
  ])

  const startBreak = useCallback(async (): Promise<CheckInOutResult> => {
    if (!user || !employee) return { success: false, error: "No autenticado" }
    if (!employee.isActive) return { success: false, error: "Tu cuenta está inactiva" }
    if (attendanceState.isOnBreak) return { success: false, error: "Ya tienes un descanso activo" }

    const lastLog = await getLastAttendanceLog()
    if (!lastLog || lastLog.action !== "check_in") {
      return { success: false, error: "Debes iniciar turno antes de tomar descanso" }
    }

    if (actionInFlightRef.current) return { success: false, error: "Acción en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)

    try {
      const { error } = await supabase.rpc("start_attendance_break", {
        p_site_id: lastLog.site_id,
        p_source: getAttendanceSource(),
        p_notes: null,
      })
      if (error) throw error

      setIsOffline(false)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await loadTodayAttendance()
      return { success: true, timestamp: new Date().toISOString() }
    } catch (err) {
      const offline = isLikelyOfflineError(err)
      setIsOffline(offline)
      return {
        success: false,
        error: offline
          ? "Sin conexión. Intenta de nuevo."
          : String((err as any)?.message ?? "No se pudo iniciar el descanso"),
      }
    } finally {
      actionInFlightRef.current = false
      setIsLoading(false)
    }
  }, [user, employee, attendanceState.isOnBreak, getLastAttendanceLog, loadTodayAttendance])

  const endBreak = useCallback(async (): Promise<CheckInOutResult> => {
    if (!user || !employee) return { success: false, error: "No autenticado" }
    if (!employee.isActive) return { success: false, error: "Tu cuenta está inactiva" }

    if (actionInFlightRef.current) return { success: false, error: "Acción en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)

    try {
      const { error } = await supabase.rpc("end_attendance_break", {
        p_source: getAttendanceSource(),
        p_notes: null,
      })
      if (error) throw error

      setIsOffline(false)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await loadTodayAttendance()
      return { success: true, timestamp: new Date().toISOString() }
    } catch (err) {
      const offline = isLikelyOfflineError(err)
      const noBreak = isNoActiveBreakError(err)
      setIsOffline(offline)
      return {
        success: false,
        error: offline
          ? "Sin conexión. Intenta de nuevo."
          : noBreak
            ? "No tienes un descanso activo"
            : String((err as any)?.message ?? "No se pudo finalizar el descanso"),
      }
    } finally {
      actionInFlightRef.current = false
      setIsLoading(false)
    }
  }, [user, employee, loadTodayAttendance])

  const registerOpenShiftDepartureEvent = useCallback(
    async (location: ValidatedLocation) => {
      if (!user || !employee) return
      if (attendanceState.status !== "checked_in") return
      if (attendanceState.isOnBreak) return
      if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        return
      }

      const now = Date.now()
      if (now - departureLastCheckAtRef.current < SHIFT_DEPARTURE_TRACKING.minCheckIntervalMs) {
        return
      }
      departureLastCheckAtRef.current = now

      const accuracy = location.accuracy ?? 999
      if (accuracy > SHIFT_DEPARTURE_TRACKING.maxAccuracyMeters) return

      const lastLog = await getLastAttendanceLog()
      if (!lastLog || lastLog.action !== "check_in") return

      const shiftKey = `${lastLog.site_id}|${lastLog.occurred_at}`
      if (departureLoggedShiftKeyRef.current === shiftKey) return
      if (departureEventInFlightRef.current) return

      const resolved = await resolveSite(lastLog.site_id)
      if (!resolved.site || !resolved.hasCoordinates || !resolved.site.requiresGeolocation) return

      const distanceMeters = calculateDistance(
        location.latitude,
        location.longitude,
        resolved.site.latitude,
        resolved.site.longitude,
      )
      const isOutside = distanceMeters + accuracy >= SHIFT_DEPARTURE_TRACKING.thresholdMeters
      if (!isOutside) return

      departureEventInFlightRef.current = true
      try {
        const occurredAtIso = new Date(Math.min(location.timestamp ?? now, now)).toISOString()
        const { data, error } = await supabase.rpc("register_shift_departure_event", {
          p_site_id: lastLog.site_id,
          p_distance_meters: Math.round(distanceMeters),
          p_accuracy_meters: Math.round(accuracy),
          p_source: getAttendanceSource(),
          p_notes: null,
          p_occurred_at: occurredAtIso,
        })

        if (error) {
          console.warn("[ATTENDANCE] No se pudo registrar evento de salida de sede:", error)
          return
        }

        const payload = (data as { inserted?: boolean; reason?: string } | null) ?? null
        if (payload?.inserted || payload?.reason === "already_recorded") {
          departureLoggedShiftKeyRef.current = shiftKey
        }
      } catch (err) {
        console.warn("[ATTENDANCE] Error registrando salida de sede:", err)
      } finally {
        departureEventInFlightRef.current = false
      }
    },
    [
      user,
      employee,
      attendanceState.status,
      attendanceState.isOnBreak,
      getLastAttendanceLog,
      resolveSite,
    ],
  )

  const startRealtimeGeofence = useCallback(async () => {
    if (realtimeWatchRef.current) return

    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== "granted") return

    const isEnabled = await Location.hasServicesEnabledAsync()
    if (!isEnabled) return

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 2500,
        distanceInterval: 5,
        mayShowUserSettingsDialog: true,
      },
      (rawLocation) => {
        const now = Date.now()
        if (now - lastRealtimeTickRef.current < 2000) return
        lastRealtimeTickRef.current = now

        const validated = buildValidatedLocationFromRaw(rawLocation)
        void refreshGeofence({ force: true, location: validated, silent: true, source: "auto" })
        void registerOpenShiftDepartureEvent(validated)
      }
    )

    realtimeWatchRef.current = subscription
  }, [refreshGeofence, registerOpenShiftDepartureEvent])

  const stopRealtimeGeofence = useCallback(() => {
    if (realtimeWatchRef.current) {
      realtimeWatchRef.current.remove()
      realtimeWatchRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopRealtimeGeofence()
  }, [stopRealtimeGeofence])

  const selectSiteForCheckIn = useCallback(
    async (siteId: string) => {
      await setSelectedSite(siteId)
      await refreshGeofence({ force: true, mode: "check_in", siteId, source: "user" })
    },
    [refreshGeofence, setSelectedSite]
  )

  return {
    attendanceState,
    geofenceState,
    refreshGeofence,
    isLoading,
    isOffline,
    loadTodayAttendance,
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    selectSiteForCheckIn,
    startRealtimeGeofence,
    stopRealtimeGeofence,
  }
}

