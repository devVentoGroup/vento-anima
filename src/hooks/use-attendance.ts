import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

export type AttendanceStatus = "not_checked_in" | "checked_in" | "checked_out"

export interface AttendanceState {
  status: AttendanceStatus
  lastCheckIn: string | null
  lastCheckOut: string | null
  lastCheckOutSource: string | null
  lastCheckOutNotes: string | null
  todayMinutes: number
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

const ATTENDANCE_GEOFENCE = {
  // Debe coincidir con la validacion del trigger en BD
  checkIn: { radiusCapMeters: 20, maxAccuracyMeters: 20 },
  checkOut: { radiusCapMeters: 30, maxAccuracyMeters: 25 },
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

export function useAttendance() {
  const { user, employee, employeeSites, selectedSiteId, setSelectedSite } = useAuth()

  const [attendanceState, setAttendanceState] = useState<AttendanceState>({
    status: "not_checked_in",
    lastCheckIn: null,
    lastCheckOut: null,
    lastCheckOutSource: null,
    lastCheckOutNotes: null,
    todayMinutes: 0,
    openStartAt: null,
    currentSiteName: null,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const actionInFlightRef = useRef(false)
  const realtimeWatchRef = useRef<Location.LocationSubscription | null>(null)
  const lastRealtimeTickRef = useRef(0)
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
    requiresSelection: false,
    candidateSites: null,
  })

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
              radiusMeters: fromList.radiusMeters ?? 50,
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
          radiusMeters: data.checkin_radius_meters ?? 50,
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
        openStartAt: null,
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
        .select("action, occurred_at, site_id, source, notes, device_info, sites(name)")
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

    let completedMinutes = 0
    let openCheckIn: Date | null = null

    for (const log of logs) {
      if (log.action === "check_in") {
        openCheckIn = new Date(log.occurred_at)
        continue
      }
      if (log.action === "check_out" && openCheckIn) {
        const checkOutAt = new Date(log.occurred_at)
        const diff = (checkOutAt.getTime() - openCheckIn.getTime()) / 60000
        if (diff > 0) {
          completedMinutes += diff
        }
        openCheckIn = null
      }
    }

    let status: AttendanceStatus = "not_checked_in"
    let currentSiteName: string | null = null
    let lastCheckIn: string | null = null
    let lastCheckOut: string | null = null
    let openStartAt: string | null = null

    if (lastLog?.action === "check_in") {
      status = "checked_in"
      currentSiteName = lastLog.site_name
      lastCheckIn = lastLog.occurred_at

      if (openCheckIn) {
        openStartAt = openCheckIn.toISOString()
      }

      if (!openStartAt && !lastTodayCheckIn) {
        const openStart = new Date(lastLog.occurred_at)
        const from = openStart.getTime() > start.getTime() ? openStart : start
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
    const lastCheckOutSource =
      (lastTodayCheckOut as any)?.source ?? null
    const lastCheckOutNotes =
      (lastTodayCheckOut as any)?.notes ?? null

    setAttendanceState({
      status,
      lastCheckIn,
      lastCheckOut,
      lastCheckOutSource,
      lastCheckOutNotes,
      todayMinutes: Math.max(0, Math.round(completedMinutes)),
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
    }) => {
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

      if (mode === "check_out") {
        // Para check-out, usar la sede del último check-in
        siteId = args?.siteId ?? lastLog?.site_id ?? null
      } else {
        // Para check-in:
        // Si hay múltiples sedes con GPS, SIEMPRE calcular y seleccionar la más cercana
        // Ignorar selectedSiteId cuando hay múltiples opciones con GPS
        if (args?.siteId) {
          siteId = args.siteId
        } else if (assignedGeoSites.length > 1) {
          // Múltiples sedes con GPS: SIEMPRE calcular la más cercana, ignorar selectedSiteId
          siteId = null
        } else if (assignedGeoSites.length === 1) {
          // Solo una sede con GPS: usar esa
          siteId = assignedGeoSites[0].siteId
        } else if (assignedNonGeoSites.length > 0) {
          // Solo sedes sin GPS: usar la principal o la primera
          const primary = assignedNonGeoSites.find((site) => site.isPrimary)
          siteId = primary?.siteId ?? assignedNonGeoSites[0].siteId
        } else if (selectedSiteId) {
          // Fallback: usar la seleccionada
          siteId = selectedSiteId
        }
      }

      // Verificar temprano si no hay sedes asignadas o si employeeSites aún no está cargado
      // Si employeeSites es null/undefined o está vacío, establecer estado de error inmediatamente
      if (!employeeSites || employeeSites.length === 0) {
        const next: GeofenceCheckState = {
          status: "blocked",
          canProceed: false,
          mode,
          siteId: null,
          siteName: null,
          distanceMeters: null,
          accuracyMeters: null,
          effectiveRadiusMeters: null,
          message: employeeSites === null || employeeSites === undefined 
            ? "Cargando información de sedes..." 
            : "No tienes sedes asignadas",
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

      if (mode === "check_in" && !siteId) {
        if (assignedGeoSites.length > 0) {
          if (!location) {
            // Timeout más corto para evitar que se quede bloqueado
            const locationResult = await getValidatedLocation({
              maxAccuracyMeters: policy.maxAccuracyMeters,
              samples: 3, // Reducir muestras para más rapidez
              timeoutMs: 10000, // Reducir timeout a 10 segundos
            })

            if (!locationResult.success || !locationResult.location) {
              const next: GeofenceCheckState = {
                status: "blocked",
                canProceed: false,
                mode,
                siteId: null,
                siteName: null,
                distanceMeters: null,
                accuracyMeters: null,
                effectiveRadiusMeters: null,
                message: locationResult.error || "Ubicacion requerida para continuar",
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
              status: "blocked",
              canProceed: false,
              mode,
              siteId: null,
              siteName: null,
              distanceMeters: null,
              accuracyMeters: null,
              effectiveRadiusMeters: null,
              message: "Ubicacion requerida para continuar",
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
          const currentLocation = location
          const acc = currentLocation.accuracy ?? 999

          // OBTENER COORDENADAS FRESCAS DE LA BD para cada sede asignada
          const candidatesPromises = assignedGeoSites.map(async (site) => {
            // Obtener coordenadas actualizadas de la BD
            const { data: freshSite } = await supabase
              .from("sites")
              .select("id, name, latitude, longitude, checkin_radius_meters")
              .eq("id", site.siteId)
              .single()
            
            const lat = freshSite?.latitude ?? site.latitude
            const lon = freshSite?.longitude ?? site.longitude
            const radius = freshSite?.checkin_radius_meters ?? site.radiusMeters ?? 50
            const name = freshSite?.name ?? site.siteName

            if (lat == null || lon == null) return null

            const distance = calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              lat,
              lon
            )
            const effectiveRadius = Math.min(radius, policy.radiusCapMeters)
            
            return {
              id: site.siteId,
              name: name,
              distanceMeters: Math.round(distance),
              effectiveRadiusMeters: effectiveRadius,
              requiresGeolocation: true,
              // Para debug
              _coords: { lat, lon },
            } as SiteCandidate & { _coords: { lat: number; lon: number } }
          })

          const candidatesWithNull = await Promise.all(candidatesPromises)
          const candidates = candidatesWithNull.filter(Boolean) as (SiteCandidate & { _coords: { lat: number; lon: number } })[]

          // Los candidatos ya tienen las coordenadas actualizadas de la BD

          if (candidates.length === 0) {
            const next: GeofenceCheckState = {
              status: "error",
              canProceed: false,
              mode,
              siteId: null,
              siteName: null,
              distanceMeters: null,
              accuracyMeters: acc,
              effectiveRadiusMeters: null,
              message: "Las sedes no tienen coordenadas configuradas",
              updatedAt: now,
              location: currentLocation,
              deviceInfo: buildDeviceInfoPayload(currentLocation),
              requiresSelection: false,
              candidateSites: null,
            }
            geofenceCacheRef.current = next
            setGeofenceState(next)
            return next
          }

          const inRange = candidates.filter(
            (candidate) => candidate.distanceMeters + acc <= candidate.effectiveRadiusMeters
          )

          if (inRange.length === 0) {
            const sorted = [...candidates].sort((a, b) => a.distanceMeters - b.distanceMeters)
            const next: GeofenceCheckState = {
              status: "blocked",
              canProceed: false,
              mode,
              siteId: null,
              siteName: null,
              distanceMeters: sorted[0]?.distanceMeters ?? null,
              accuracyMeters: acc,
              effectiveRadiusMeters: sorted[0]?.effectiveRadiusMeters ?? null,
              message: "No estas dentro del radio de ninguna sede",
              updatedAt: now,
              location: currentLocation,
              deviceInfo: buildDeviceInfoPayload(currentLocation),
              requiresSelection: false,
              candidateSites: sorted,
            }
            geofenceCacheRef.current = next
            setGeofenceState(next)
            return next
          }

          const sorted = [...inRange].sort((a, b) => a.distanceMeters - b.distanceMeters)
          
          // Detectar sedes con coordenadas idénticas o muy cercanas (menos de 5m de diferencia)
          // Esto es para casos como Vento Group y Vento Café que comparten la misma ubicación
          const hasIdenticalCoords = sorted.length > 1 && sorted[1].distanceMeters - sorted[0].distanceMeters < 5
          
          // También verificar si hay sedes con coordenadas exactamente iguales
          const identicalSites = candidates.filter((c1, i) => 
            candidates.some((c2, j) => 
              i !== j && 
              Math.abs(c1._coords.lat - c2._coords.lat) < 0.00001 && 
              Math.abs(c1._coords.lon - c2._coords.lon) < 0.00001 &&
              c1.distanceMeters + acc <= c1.effectiveRadiusMeters &&
              c2.distanceMeters + acc <= c2.effectiveRadiusMeters
            )
          )
          
          // Si hay múltiples sedes en rango con coordenadas idénticas o muy cercanas, mostrar selector
          if (sorted.length > 1 && (hasIdenticalCoords || identicalSites.length > 1)) {
            // Incluir todas las sedes con coordenadas idénticas o muy cercanas
            const sitesToShow = identicalSites.length > 1 
              ? identicalSites.sort((a, b) => a.distanceMeters - b.distanceMeters)
              : sorted.filter(s => s.distanceMeters - sorted[0].distanceMeters < 5)
            
            const next: GeofenceCheckState = {
              status: "blocked",
              canProceed: false,
              mode,
              siteId: null,
              siteName: null,
              distanceMeters: sitesToShow[0].distanceMeters,
              accuracyMeters: acc,
              effectiveRadiusMeters: sitesToShow[0].effectiveRadiusMeters,
              message: "Varias sedes en esta ubicación. Selecciona una para continuar.",
              updatedAt: now,
              location: currentLocation,
              deviceInfo: buildDeviceInfoPayload(currentLocation),
              requiresSelection: true,
              candidateSites: sitesToShow,
            }
            geofenceCacheRef.current = next
            setGeofenceState(next)
            return next
          }

          siteId = sorted[0].id
        } else if (assignedNonGeoSites.length > 0) {
          const primary = assignedNonGeoSites.find((site) => site.isPrimary)
          siteId = primary?.siteId ?? assignedNonGeoSites[0].siteId
        }
      }

      // Si hay múltiples sedes con GPS y ya tenemos un siteId, verificar si hay una más cercana
      if (mode === "check_in" && siteId && assignedGeoSites.length > 1 && !location) {
        // Obtener ubicación para calcular la más cercana (timeout corto)
        const locationResult = await getValidatedLocation({
          maxAccuracyMeters: policy.maxAccuracyMeters,
          samples: 2, // Reducir muestras
          timeoutMs: 8000, // Timeout más corto
        })
        
        if (locationResult.success && locationResult.location) {
          location = locationResult.location
          const currentLocation = location
          const acc = currentLocation.accuracy ?? 999

          // Calcular distancia a todas las sedes
          const candidatesPromises = assignedGeoSites.map(async (site) => {
            const { data: freshSite } = await supabase
              .from("sites")
              .select("id, name, latitude, longitude, checkin_radius_meters")
              .eq("id", site.siteId)
              .single()
            
            const lat = freshSite?.latitude ?? site.latitude
            const lon = freshSite?.longitude ?? site.longitude
            if (lat == null || lon == null) return null

            const distance = calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              lat,
              lon
            )
            
            return {
              id: site.siteId,
              distanceMeters: Math.round(distance),
            }
          })

          const candidates = (await Promise.all(candidatesPromises)).filter(Boolean) as { id: string; distanceMeters: number }[]
          if (candidates.length > 0) {
            // Ordenar por distancia y usar la más cercana
            candidates.sort((a, b) => a.distanceMeters - b.distanceMeters)
            const closestSiteId = candidates[0].id
            
            // Si la más cercana es diferente a la seleccionada, usar la más cercana
            if (closestSiteId !== siteId) {
              siteId = closestSiteId
            }
          }
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

      setGeofenceState((prev) => ({
        ...prev,
        status: "checking",
        canProceed: false,
        mode,
        siteId,
        message: "Verificando ubicacion...",
        updatedAt: now,
        requiresSelection: false,
        candidateSites: null,
      }))

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
          message: "No se pudo cargar la sede para verificar ubicacion",
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

      const effectiveRadius = Math.min(site.radiusMeters, policy.radiusCapMeters)

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
            message: locationResult.error || "Ubicacion requerida para continuar",
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
          message: "Ubicacion requerida para continuar",
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
          message: `Ubicacion no valida: ${blocking}. Desactiva ubicaciones simuladas y vuelve a intentar.`,
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
          message: `Estas a ${Math.round(distance)}m (precision ${Math.round(
            acc
          )}m). Debes estar dentro de ${effectiveRadius}m con senal suficiente.`,
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
        message: "Ubicacion verificada",
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
    if (!employee.isActive) return { success: false, error: "Tu cuenta esta inactiva" }

    const lastLog = await getLastAttendanceLog()
    if (lastLog?.action === "check_in") {
      return { success: false, error: "Ya tienes un check-in activo" }
    }

    if (actionInFlightRef.current) return { success: false, error: "Accion en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)

    try {
      // Asegurar que el geofence esté listo antes de proceder
      // En producción, el geofence puede tardar más en verificarse
      let geo = await refreshGeofence({ force: true, mode: "check_in" })
      
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
        geo = await refreshGeofence({ force: true, mode: "check_in" })
        attempts++
        
        // Si ya está listo, salir del loop
        if (geo.canProceed && geo.status === "ready") break
      }
      
      if (!geo.canProceed) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        const errorMsg = geo.status === "checking" 
          ? "La verificación de ubicación está tardando demasiado. Intenta de nuevo."
          : (geo.message || "Ubicacion no verificada")
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
          ? "Sin conexion. Intenta de nuevo."
          : friendly ?? "Error al registrar entrada",
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

    if (actionInFlightRef.current) return { success: false, error: "Accion en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)

    try {
      const siteIdToClose = lastLog.site_id

      const geo = await refreshGeofence({ force: true, mode: "check_out", siteId: siteIdToClose })
      if (!geo.canProceed) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return { success: false, error: geo.message || "Ubicacion no verificada" }
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
          ? "Sin conexion. Intenta de nuevo."
          : friendly ?? "Error al registrar salida",
      }
    } finally {
      actionInFlightRef.current = false
      setIsLoading(false)
    }
  }, [user, employee, getLastAttendanceLog, refreshGeofence, loadTodayAttendance])

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
        void refreshGeofence({ force: true, location: validated })
      }
    )

    realtimeWatchRef.current = subscription
  }, [refreshGeofence])

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
      await refreshGeofence({ force: true, mode: "check_in", siteId })
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
    selectSiteForCheckIn,
    startRealtimeGeofence,
    stopRealtimeGeofence,
  }
}
