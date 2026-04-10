import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Haptics from "expo-haptics"
import * as Location from "expo-location"
import * as SecureStore from "expo-secure-store"
import { Alert, AppState } from "react-native"

import { supabase } from "@/lib/supabase"
import {
  buildValidatedLocationFromRaw,
  calculateDistance,
  getValidatedLocation,
  type SiteCoordinates,
  type ValidatedLocation,
} from "@/lib/geolocation"
import { getUserFacingAttendanceError } from "@/utils/error-messages"
import { useAuth } from "@/contexts/auth-context"
import { useAttendancePolicy } from "@/hooks/use-attendance-policy"

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
  /** Sede del check-in actual (o del último check-in del día si ya hizo check-out). Para integrar con turno del día. */
  currentSiteId: string | null
}

export interface CheckInOutResult {
  success: boolean
  error?: string
  timestamp?: string
  queued?: boolean
}

export type GeofenceMode = "check_in" | "check_out"

export interface SiteCandidate {
  id: string
  name: string
  distanceMeters: number | null
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
  isLatchedReady?: boolean
  latchedReason?: "network" | "location" | null
  latchExpiresAt?: number | null
  requiresSelection: boolean
  candidateSites: SiteCandidate[] | null
}

export type GeofenceLatchState = {
  siteId: string
  grantedAt: string
  expiresAt: string
  distanceMeters: number
  accuracy: number
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

type AttendanceInsertPayload = {
  employee_id: string
  site_id: string
  action: "check_in" | "check_out"
  source: string
  latitude: number | null
  longitude: number | null
  accuracy_meters: number | null
  device_info: Record<string, unknown> | null
  notes: string | null
  occurred_at: string
  /** Turno programado del día en esta sede (opcional); relaciona check-in con turno. */
  shift_id?: string | null
}

type QueueSyncDecision =
  | { kind: "proceed" }
  | { kind: "drop"; reason: string }
  | { kind: "conflict"; reason: string }

type SyncResultItem = {
  eventId: string
  result: "applied" | "duplicate" | "conflict" | "error"
  message?: string
}

type DiagnosticStage = "gps" | "network" | "db" | "permission" | "sync" | "queue" | "geofence"

type AttendanceDiagnostics = {
  lastGeofenceDurationMs: number | null
  lastCheckInDurationMs: number | null
  lastCheckOutDurationMs: number | null
  lastSyncDurationMs: number | null
  lastErrorStage: DiagnosticStage | null
  lastErrorMessage: string | null
  lastErrorAt: string | null
  gpsErrorCount: number
  networkErrorCount: number
  dbErrorCount: number
  permissionErrorCount: number
  syncConflictCount: number
}

export type AttendanceUxState =
  | "checking"
  | "ready"
  | "queued"
  | "syncing"
  | "failed"
  | "blocked"

const ATTENDANCE_UX_MESSAGES: Record<AttendanceUxState, string> = {
  checking: "Validando ubicación...",
  ready: "Listo para registrar",
  queued: "Registro guardado. Se sincroniza automáticamente.",
  syncing: "Sincronizando registros pendientes...",
  failed: "No se pudo sincronizar. Reintentaremos automáticamente.",
  blocked: "Debes validar ubicación en sede para registrar sin internet.",
}

type PendingAttendanceStatus = "pending" | "syncing" | "failed" | "conflict"

type PendingAttendanceEventType = "check_in" | "check_out" | "break_start" | "break_end"

type PendingGeoSnapshot = {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
  distanceMeters?: number
}

type PendingAttendanceEvent = {
  id: string
  eventId: string
  eventType: PendingAttendanceEventType
  siteId: string
  occurredAt: string
  geoSnapshot: PendingGeoSnapshot | null
  payload: AttendanceInsertPayload
  createdAt: string
  attempts: number
  status: PendingAttendanceStatus
  lastError: string | null
  nextRetryAt: number | null
}

type PendingBreakAction = "start" | "end"

type PendingBreakPayload = {
  action: PendingBreakAction
  site_id: string | null
  source: string
  notes: string | null
  clientEventId: string
  queuedAt: string
}

type PendingBreakStatus = "pending" | "syncing" | "failed" | "conflict"

type PendingBreakEvent = {
  id: string
  payload: PendingBreakPayload
  createdAt: string
  attempts: number
  status: PendingBreakStatus
  lastError: string | null
  nextRetryAt: number | null
}

const ATTENDANCE_GEOFENCE = {
  // Debe coincidir con la validacion del trigger en BD
  checkIn: { maxAccuracyMeters: 20 },
  checkOut: { maxAccuracyMeters: 25 },
}

const SHIFT_DEPARTURE_TRACKING = {
  thresholdMeters: 200,
  maxAccuracyMeters: 35,
  minCheckIntervalMs: 45000,
}

const GEOFENCE_READY_CACHE_MS = 45000
const SITE_RESOLVE_CACHE_MS = 5 * 60 * 1000
const ATTENDANCE_WRITE_MAX_ATTEMPTS = 3
const ATTENDANCE_WRITE_BASE_DELAY_MS = 700
const ATTENDANCE_RECONCILE_WINDOW_MS = 2 * 60 * 1000
const ATTENDANCE_SYNC_INTERVAL_MS = 15000
const ATTENDANCE_SYNC_MAX_RETRY_DELAY_MS = 2 * 60 * 1000
const GEOFENCE_LATCH_TTL_CHECKIN_MS = 15 * 60 * 1000
const GEOFENCE_LATCH_TTL_CHECKOUT_MS = 10 * 60 * 1000

function getAttendanceSource(): string {
  return "mobile"
}

function getAttendanceQueueStorageKey(userId: string): string {
  return `attendance_queue_${userId}`
}

function getBreakQueueStorageKey(userId: string): string {
  return `attendance_breakqueue_${userId}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildPendingAttendanceId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function buildGeoSnapshotFromPayload(
  payload: AttendanceInsertPayload,
  distanceMeters?: number
): PendingGeoSnapshot | null {
  if (payload.latitude == null || payload.longitude == null || payload.accuracy_meters == null) {
    return null
  }

  return {
    lat: payload.latitude,
    lng: payload.longitude,
    accuracy: payload.accuracy_meters,
    timestamp: Date.parse(payload.occurred_at) || Date.now(),
    distanceMeters,
  }
}

function normalizePendingAttendanceEvent(raw: any): PendingAttendanceEvent | null {
  if (!raw?.id || !raw?.payload) return null
  const payload = raw.payload as AttendanceInsertPayload
  if (!payload?.site_id || !payload?.action || !payload?.occurred_at) return null
  const eventId =
    String(raw.eventId ?? payload?.device_info?.["clientEventId"] ?? buildClientEventId(payload.action))
  const eventType = (raw.eventType ?? payload.action) as PendingAttendanceEventType
  const normalizedStatus: PendingAttendanceStatus =
    raw.status === "syncing" || raw.status === "failed" || raw.status === "conflict"
      ? raw.status
      : "pending"
  const attempts = Number.isFinite(raw.attempts) ? Math.max(0, Number(raw.attempts)) : 0
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString()
  const occurredAt = typeof raw.occurredAt === "string" ? raw.occurredAt : payload.occurred_at
  const siteId = typeof raw.siteId === "string" ? raw.siteId : payload.site_id
  const geoSnapshot: PendingGeoSnapshot | null =
    raw.geoSnapshot && typeof raw.geoSnapshot === "object"
      ? {
          lat: Number(raw.geoSnapshot.lat),
          lng: Number(raw.geoSnapshot.lng),
          accuracy: Number(raw.geoSnapshot.accuracy),
          timestamp: Number(raw.geoSnapshot.timestamp) || Date.now(),
          distanceMeters:
            raw.geoSnapshot.distanceMeters != null ? Number(raw.geoSnapshot.distanceMeters) : undefined,
        }
      : buildGeoSnapshotFromPayload(payload)

  return {
    id: String(raw.id),
    eventId,
    eventType,
    siteId,
    occurredAt,
    geoSnapshot,
    payload,
    createdAt,
    attempts,
    status: normalizedStatus,
    lastError: raw.lastError ? String(raw.lastError) : null,
    nextRetryAt: typeof raw.nextRetryAt === "number" ? raw.nextRetryAt : null,
  }
}

function getRetryDelayMs(attempts: number): number {
  const next = ATTENDANCE_WRITE_BASE_DELAY_MS * Math.pow(2, Math.max(0, attempts - 1))
  return Math.min(next, ATTENDANCE_SYNC_MAX_RETRY_DELAY_MS)
}

function getErrorMessage(err: unknown): string {
  if (!err) return "Error desconocido"
  const anyErr = err as any
  return String(anyErr?.message ?? anyErr)
}

function classifyDiagnosticStage(err: unknown): DiagnosticStage {
  if (isLikelyOfflineError(err)) return "network"
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase()
  if (msg.includes("permission") || msg.includes("permiso")) return "permission"
  if (
    msg.includes("gps") ||
    msg.includes("ubicacion") ||
    msg.includes("location") ||
    msg.includes("fuera de rango")
  ) {
    return "gps"
  }
  if (
    msg.includes("postgres") ||
    msg.includes("sql") ||
    msg.includes("trigger") ||
    msg.includes("supabase")
  ) {
    return "db"
  }
  return "geofence"
}

function buildClientEventId(action: string): string {
  return `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getGeofenceLatchTtlMs(mode: GeofenceMode): number {
  return mode === "check_in" ? GEOFENCE_LATCH_TTL_CHECKIN_MS : GEOFENCE_LATCH_TTL_CHECKOUT_MS
}

function isLikelyTransientGeoError(message: string | null | undefined): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("network") ||
    m.includes("sin conexión") ||
    m.includes("sin conexion") ||
    m.includes("unavailable") ||
    m.includes("temporarily") ||
    m.includes("no se pudo obtener")
  )
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
  const { policy: attendancePolicy } = useAttendancePolicy()

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
    currentSiteId: null,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [pendingAttendanceQueue, setPendingAttendanceQueue] = useState<PendingAttendanceEvent[]>([])
  const [pendingBreakQueue, setPendingBreakQueue] = useState<PendingBreakEvent[]>([])
  const [attendanceDiagnostics, setAttendanceDiagnostics] = useState<AttendanceDiagnostics>({
    lastGeofenceDurationMs: null,
    lastCheckInDurationMs: null,
    lastCheckOutDurationMs: null,
    lastSyncDurationMs: null,
    lastErrorStage: null,
    lastErrorMessage: null,
    lastErrorAt: null,
    gpsErrorCount: 0,
    networkErrorCount: 0,
    dbErrorCount: 0,
    permissionErrorCount: 0,
    syncConflictCount: 0,
  })

  const actionInFlightRef = useRef(false)
  const syncInFlightRef = useRef(false)
  const breakSyncInFlightRef = useRef(false)
  const realtimeWatchRef = useRef<Location.LocationSubscription | null>(null)
  const lastRealtimeTickRef = useRef(0)
  const geofenceCacheRef = useRef<GeofenceCheckState | null>(null)
  const geofenceLatchRef = useRef<GeofenceLatchState | null>(null)
  const siteResolveCacheRef = useRef<
    Map<string, { site: SiteCoordinates; hasCoordinates: boolean; cachedAt: number }>
  >(new Map())
  const departureEventInFlightRef = useRef(false)
  const departureLastCheckAtRef = useRef(0)
  const departureLoggedShiftKeyRef = useRef<string | null>(null)
  const departureAutoCheckoutNotifiedShiftRef = useRef<string | null>(null)

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
    isLatchedReady: false,
    latchedReason: null,
    latchExpiresAt: null,
    requiresSelection: false,
    candidateSites: null,
  })

  useEffect(() => {
    if (attendanceState.status !== "checked_in") {
      departureLoggedShiftKeyRef.current = null
      departureAutoCheckoutNotifiedShiftRef.current = null
    }
  }, [attendanceState.status])

  const resolveSite = useCallback(
    async (siteId: string): Promise<{ site: SiteCoordinates | null; hasCoordinates: boolean }> => {
      const now = Date.now()
      const cached = siteResolveCacheRef.current.get(siteId)
      if (cached && now - cached.cachedAt <= SITE_RESOLVE_CACHE_MS) {
        return { site: cached.site, hasCoordinates: cached.hasCoordinates }
      }

      const { data, error } = await supabase
        .from("sites")
        .select("id, name, latitude, longitude, checkin_radius_meters, type")
        .eq("id", siteId)
        .single()

      if (error || !data) {
        console.error('[resolveSite] Error obteniendo sede de BD:', error)
        if (cached) {
          console.warn('[resolveSite] Usando sede en cache por falla de red')
          return { site: cached.site, hasCoordinates: cached.hasCoordinates }
        }

        const fromList = employeeSites.find((item) => item.siteId === siteId)
        if (fromList) {
          console.warn('[resolveSite] Usando employeeSites como fallback')
          const hasCoordinates = fromList.latitude != null && fromList.longitude != null
          const requiresGeolocation = hasCoordinates
          const result = {
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
          siteResolveCacheRef.current.set(siteId, {
            site: result.site,
            hasCoordinates,
            cachedAt: now,
          })
          return result
        }
        return { site: null, hasCoordinates: false }
      }

      const hasCoordinates = data.latitude != null && data.longitude != null
      let radiusMeters = data.checkin_radius_meters ?? 0
      let requiresGeolocation = hasCoordinates
      try {
        const { data: policyRow } = await supabase
          .from("site_attendance_policy")
          .select("checkin_radius_meters, requires_geofence")
          .eq("site_id", siteId)
          .maybeSingle()
        if (policyRow) {
          if (policyRow.checkin_radius_meters != null)
            radiusMeters = Number(policyRow.checkin_radius_meters)
          if (policyRow.requires_geofence != null)
            requiresGeolocation = Boolean(policyRow.requires_geofence)
        }
      } catch {
        // Tabla inexistente o sin permiso: usar solo datos de sites
      }
      const result = {
        site: {
          id: data.id,
          name: data.name,
          latitude: data.latitude ?? 0,
          longitude: data.longitude ?? 0,
          radiusMeters,
          requiresGeolocation,
        },
        hasCoordinates,
      }

      siteResolveCacheRef.current.set(siteId, {
        site: result.site,
        hasCoordinates,
        cachedAt: now,
      })
      return result
    },
    [employeeSites]
  )

  const getLastAttendanceLog = useCallback(async (): Promise<{
    action: "check_in" | "check_out"
    occurred_at: string
    site_id: string
    site_name: string | null
    source: string | null
    shift_id: string | null
    client_event_id: string | null
  } | null> => {
    if (!user) return null

    const { data, error } = await supabase
      .from("attendance_logs")
      .select("action, occurred_at, site_id, source, shift_id, device_info, sites(name)")
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
      source: data.source ?? null,
      shift_id: (data as any)?.shift_id ?? null,
      client_event_id: (data as any)?.device_info?.clientEventId ?? null,
    }
  }, [user])

  /** Turno publicado del día para este empleado en esta sede (para relacionar check-in con turno). */
  const getTodayShiftIdForSite = useCallback(
    async (employeeId: string, siteId: string): Promise<string | null> => {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from("employee_shifts")
        .select("id")
        .eq("employee_id", employeeId)
        .eq("site_id", siteId)
        .eq("shift_date", today)
        .neq("shift_kind", "descanso")
        .not("published_at", "is", null)
        .limit(1)
        .maybeSingle()
      if (error || !data) return null
      return (data as { id: string }).id
    },
    []
  )

  const loadPendingAttendanceQueue = useCallback(async (): Promise<PendingAttendanceEvent[]> => {
    if (!user) return []
    try {
      const raw = await SecureStore.getItemAsync(getAttendanceQueueStorageKey(user.id))
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      const normalized = parsed
        .map((item) => normalizePendingAttendanceEvent(item))
        .filter((item): item is PendingAttendanceEvent => item != null)
      return normalized
    } catch (error) {
      console.warn("[ATTENDANCE] No se pudo cargar cola pendiente:", error)
      recordDiagnosticError("queue", getErrorMessage(error))
      return []
    }
  }, [recordDiagnosticError, user])

  const persistPendingAttendanceQueue = useCallback(
    async (queue: PendingAttendanceEvent[]) => {
      if (!user) return
      try {
        const key = getAttendanceQueueStorageKey(user.id)
        if (queue.length === 0) {
          await SecureStore.deleteItemAsync(key)
          return
        }
        await SecureStore.setItemAsync(key, JSON.stringify(queue))
      } catch (error) {
        console.warn("[ATTENDANCE] No se pudo guardar cola pendiente:", error)
        recordDiagnosticError("queue", getErrorMessage(error))
      }
    },
    [recordDiagnosticError, user]
  )

  const setAndPersistPendingAttendanceQueue = useCallback(
    async (nextQueue: PendingAttendanceEvent[]) => {
      setPendingAttendanceQueue(nextQueue)
      await persistPendingAttendanceQueue(nextQueue)
    },
    [persistPendingAttendanceQueue]
  )

  const loadPendingBreakQueue = useCallback(async (): Promise<PendingBreakEvent[]> => {
    if (!user) return []
    try {
      const raw = await SecureStore.getItemAsync(getBreakQueueStorageKey(user.id))
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((item) => !!item?.id && !!item?.payload) as PendingBreakEvent[]
    } catch (error) {
      console.warn("[ATTENDANCE] No se pudo cargar cola de descansos:", error)
      recordDiagnosticError("queue", getErrorMessage(error))
      return []
    }
  }, [recordDiagnosticError, user])

  const persistPendingBreakQueue = useCallback(
    async (queue: PendingBreakEvent[]) => {
      if (!user) return
      try {
        const key = getBreakQueueStorageKey(user.id)
        if (queue.length === 0) {
          await SecureStore.deleteItemAsync(key)
          return
        }
        await SecureStore.setItemAsync(key, JSON.stringify(queue))
      } catch (error) {
        console.warn("[ATTENDANCE] No se pudo guardar cola de descansos:", error)
        recordDiagnosticError("queue", getErrorMessage(error))
      }
    },
    [recordDiagnosticError, user]
  )

  const setAndPersistPendingBreakQueue = useCallback(
    async (nextQueue: PendingBreakEvent[]) => {
      setPendingBreakQueue(nextQueue)
      await persistPendingBreakQueue(nextQueue)
    },
    [persistPendingBreakQueue]
  )

  const getOpenBreak = useCallback(async (): Promise<AttendanceBreakRow | null> => {
    if (!user) return null
    const { data, error } = await supabase
      .from("attendance_breaks")
      .select("started_at, ended_at")
      .eq("employee_id", user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return null
    return (data as AttendanceBreakRow | null) ?? null
  }, [user])

  function recordDiagnosticError(stage: DiagnosticStage, message: string) {
    setAttendanceDiagnostics((prev) => ({
      ...prev,
      lastErrorStage: stage,
      lastErrorMessage: message,
      lastErrorAt: new Date().toISOString(),
      gpsErrorCount: prev.gpsErrorCount + (stage === "gps" ? 1 : 0),
      networkErrorCount: prev.networkErrorCount + (stage === "network" ? 1 : 0),
      dbErrorCount: prev.dbErrorCount + (stage === "db" ? 1 : 0),
      permissionErrorCount: prev.permissionErrorCount + (stage === "permission" ? 1 : 0),
    }))
  }

  const setLatchFromSuccess = useCallback((state: GeofenceCheckState) => {
    if (!state.canProceed || state.status !== "ready" || !state.siteId || !state.updatedAt) return
    if (state.distanceMeters == null || state.accuracyMeters == null) return

    const ttlMs =
      state.mode === "check_in"
        ? attendancePolicy.geofence_latch_ttl_checkin_ms
        : attendancePolicy.geofence_latch_ttl_checkout_ms
    geofenceLatchRef.current = {
      siteId: state.siteId,
      grantedAt: new Date(state.updatedAt).toISOString(),
      expiresAt: new Date(state.updatedAt + ttlMs).toISOString(),
      distanceMeters: state.distanceMeters,
      accuracy: state.accuracyMeters,
    }
  }, [attendancePolicy.geofence_latch_ttl_checkin_ms, attendancePolicy.geofence_latch_ttl_checkout_ms])

  const clearExpiredLatch = useCallback(() => {
    const current = geofenceLatchRef.current
    if (!current) return
    if (Date.parse(current.expiresAt) > Date.now()) return
    geofenceLatchRef.current = null
  }, [])

  const isLatchValidFor = useCallback(
    (siteId?: string | null): boolean => {
      clearExpiredLatch()
      const current = geofenceLatchRef.current
      if (!current) return false
      if (siteId && current.siteId !== siteId) return false
      return Date.parse(current.expiresAt) > Date.now()
    },
    [clearExpiredLatch]
  )

  const canQueueByPolicy = useCallback(
    (opts: { networkError: boolean; latchValid: boolean; eventType: PendingAttendanceEventType }) => {
      if (!opts.networkError) return false
      if (opts.eventType === "break_start" || opts.eventType === "break_end") return opts.latchValid
      return opts.latchValid
    },
    []
  )

  useEffect(() => {
    if (geofenceState.status === "ready" && geofenceState.canProceed) {
      setLatchFromSuccess(geofenceState)
    }
  }, [geofenceState, setLatchFromSuccess])

  const canReuseRecentReadyGeofence = useCallback(
    (
      mode: GeofenceMode,
      siteId?: string | null,
      maxAgeMs?: number
    ): GeofenceCheckState | null => {
      const latchTtlMs =
        mode === "check_in"
          ? attendancePolicy.geofence_latch_ttl_checkin_ms
          : attendancePolicy.geofence_latch_ttl_checkout_ms
      const effectiveMaxAgeMs = maxAgeMs ?? latchTtlMs
      const cached = geofenceCacheRef.current
      if (!cached) return null
      if (cached.status !== "ready" || !cached.canProceed) return null
      if (cached.mode !== mode) return null
      if (!cached.updatedAt || Date.now() - cached.updatedAt > effectiveMaxAgeMs) return null
      if (siteId && cached.siteId !== siteId) return null
      return cached
    },
    [attendancePolicy.geofence_latch_ttl_checkin_ms, attendancePolicy.geofence_latch_ttl_checkout_ms]
  )

  const buildLatchedReadyState = useCallback(
    (
      cachedReady: GeofenceCheckState,
      source: "auto" | "user" | "check_action",
      reason: "network" | "location"
    ): GeofenceCheckState => {
      const ageMs = Date.now() - (cachedReady.updatedAt ?? Date.now())
      const maxMs =
        cachedReady.mode === "check_in"
          ? attendancePolicy.geofence_latch_ttl_checkin_ms
          : attendancePolicy.geofence_latch_ttl_checkout_ms
      const remainingMs = Math.max(0, maxMs - ageMs)
      const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000))
      const reasonText =
        reason === "network" ? "sin conexión estable" : "con GPS inestable"

      return {
        ...cachedReady,
        lastUpdateSource: source,
        isLatchedReady: true,
        latchedReason: reason,
        latchExpiresAt: (cachedReady.updatedAt ?? Date.now()) + maxMs,
        message: `Ubicación verificada recientemente (${reasonText}). Puedes registrar por ${remainingMin} min.`,
      }
    },
    [attendancePolicy.geofence_latch_ttl_checkin_ms, attendancePolicy.geofence_latch_ttl_checkout_ms]
  )

  const insertAttendanceLogWithRetry = useCallback(
    async (payload: AttendanceInsertPayload) => {
      let lastError: unknown = null

      for (let attempt = 1; attempt <= ATTENDANCE_WRITE_MAX_ATTEMPTS; attempt++) {
        const { error } = await supabase.from("attendance_logs").insert(payload)
        if (!error) return

        lastError = error
        const isOfflineLike = isLikelyOfflineError(error)
        if (!isOfflineLike) break

        // Reconciliación: puede haber quedado insertado aunque falle la respuesta.
        try {
          const latest = await getLastAttendanceLog()
          if (
            latest &&
            latest.action === payload.action &&
            latest.site_id === payload.site_id &&
            latest.source === payload.source &&
            (latest.client_event_id === (payload.device_info as any)?.clientEventId ||
              Date.now() - new Date(latest.occurred_at).getTime() <= ATTENDANCE_RECONCILE_WINDOW_MS)
          ) {
            return
          }
        } catch {
          // Best effort.
        }

        if (attempt < ATTENDANCE_WRITE_MAX_ATTEMPTS) {
          const backoff = ATTENDANCE_WRITE_BASE_DELAY_MS * attempt
          await sleep(backoff)
        }
      }

      throw lastError
    },
    [getLastAttendanceLog]
  )

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
        currentSiteId: null,
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
    let currentSiteId: string | null = null
    let lastCheckIn: string | null = null
    let lastCheckOut: string | null = null
    let openStartAt: string | null = null

    if (lastLog?.action === "check_in") {
      status = "checked_in"
      currentSiteName = lastLog.site_name
      currentSiteId = (lastLog as { site_id?: string })?.site_id ?? null
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
        const logWithSiteId = lastTodayCheckIn as { site_id?: string; sites?: { name: string } }
        currentSiteId = logWithSiteId?.site_id ?? null
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
      currentSiteId,
    })
    setIsOffline(false)
  }, [user, getLastAttendanceLog])

  const enqueuePendingAttendanceEvent = useCallback(
    async (payload: AttendanceInsertPayload, err: unknown) => {
      const eventId = String(payload?.device_info?.["clientEventId"] ?? buildClientEventId(payload.action))
      const nowIso = new Date().toISOString()
      const nextItem: PendingAttendanceEvent = {
        id: buildPendingAttendanceId(),
        eventId,
        eventType: payload.action,
        siteId: payload.site_id,
        occurredAt: payload.occurred_at,
        geoSnapshot: buildGeoSnapshotFromPayload(payload),
        payload,
        createdAt: nowIso,
        attempts: 0,
        status: "pending",
        lastError: getErrorMessage(err),
        nextRetryAt: Date.now() + getRetryDelayMs(1),
      }
      const nextQueue = [...pendingAttendanceQueue, nextItem]
      await setAndPersistPendingAttendanceQueue(nextQueue)
      return nextItem
    },
    [pendingAttendanceQueue, setAndPersistPendingAttendanceQueue]
  )

  const enqueuePendingBreakEvent = useCallback(
    async (payload: PendingBreakPayload, err: unknown) => {
      const nextItem: PendingBreakEvent = {
        id: buildPendingAttendanceId(),
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: "pending",
        lastError: getErrorMessage(err),
        nextRetryAt: Date.now() + getRetryDelayMs(1),
      }
      const nextQueue = [...pendingBreakQueue, nextItem]
      await setAndPersistPendingBreakQueue(nextQueue)
      return nextItem
    },
    [pendingBreakQueue, setAndPersistPendingBreakQueue]
  )

  const applyOptimisticAttendanceUpdate = useCallback(
    (payload: AttendanceInsertPayload, siteName: string | null) => {
      setAttendanceState((prev) => {
        const snapshotAt = new Date().toISOString()
        if (payload.action === "check_in") {
          return {
            ...prev,
            status: "checked_in",
            lastCheckIn: payload.occurred_at,
            snapshotAt,
            openStartAt: payload.occurred_at,
            currentSiteName: siteName ?? prev.currentSiteName,
            currentSiteId: payload.site_id ?? prev.currentSiteId,
          }
        }
        return {
          ...prev,
          status: "checked_out",
          lastCheckOut: payload.occurred_at,
          snapshotAt,
          openStartAt: null,
          isOnBreak: false,
          openBreakStartAt: null,
        }
      })
    },
    []
  )

  const applyOptimisticBreakUpdate = useCallback((action: PendingBreakAction, atIso: string) => {
    setAttendanceState((prev) => {
      if (action === "start") {
        return {
          ...prev,
          isOnBreak: true,
          openBreakStartAt: atIso,
        }
      }
      return {
        ...prev,
        isOnBreak: false,
        openBreakStartAt: null,
      }
    })
  }, [])

  const evaluateBreakSyncDecision = useCallback(
    async (item: PendingBreakEvent): Promise<QueueSyncDecision> => {
      const last = await getLastAttendanceLog()
      const openBreak = await getOpenBreak()

      if (item.payload.action === "start") {
        if (!last || last.action !== "check_in") {
          return {
            kind: "conflict",
            reason: "Conflicto de secuencia: no hay turno activo para iniciar descanso.",
          }
        }
        if (openBreak) {
          return { kind: "drop", reason: "Descanso ya activo (evento duplicado)." }
        }
        return { kind: "proceed" }
      }

      if (!openBreak) {
        return { kind: "drop", reason: "No hay descanso activo (cierre duplicado)." }
      }
      return { kind: "proceed" }
    },
    [getLastAttendanceLog, getOpenBreak]
  )

  const evaluateQueueSyncDecision = useCallback(
    async (item: PendingAttendanceEvent): Promise<QueueSyncDecision> => {
      const last = await getLastAttendanceLog()
      if (!last) {
        if (item.payload.action === "check_in") return { kind: "proceed" }
        return {
          kind: "conflict",
          reason: "Conflicto de secuencia: no hay check-in activo para este check-out.",
        }
      }

      if (item.payload.action === "check_in") {
        if (last.action === "check_in") {
          if (last.site_id === item.payload.site_id) {
            return { kind: "drop", reason: "Check-in ya activo (evento duplicado)." }
          }
          return {
            kind: "conflict",
            reason: "Conflicto de secuencia: ya existe un check-in activo en otra sede.",
          }
        }
        return { kind: "proceed" }
      }

      if (last.action === "check_out") {
        return { kind: "drop", reason: "Turno ya cerrado (check-out duplicado)." }
      }
      if (last.site_id !== item.payload.site_id) {
        return {
          kind: "conflict",
          reason: "Conflicto de sede: check-out pendiente no coincide con sede activa.",
        }
      }
      return { kind: "proceed" }
    },
    [getLastAttendanceLog]
  )

  const syncAttendanceEventOnServer = useCallback(
    async (item: PendingAttendanceEvent): Promise<SyncResultItem> => {
      const payloadForRpc = {
        eventId: item.eventId,
        eventType: item.eventType,
        action: item.payload.action,
        siteId: item.siteId,
        occurredAt: item.occurredAt,
        source: item.payload.source,
        notes: item.payload.notes,
        geoSnapshot: item.geoSnapshot,
        deviceInfo: item.payload.device_info,
        ...(item.payload.shift_id ? { shiftId: item.payload.shift_id } : {}),
      }

      try {
        const { data, error } = await supabase.rpc("sync_attendance_events", {
          p_events: [payloadForRpc],
        })
        if (error) throw error
        const first = Array.isArray(data) ? data[0] : data
        const result = String((first as any)?.result ?? "error").toLowerCase()
        const message = (first as any)?.message ? String((first as any).message) : undefined
        if (result === "applied" || result === "duplicate" || result === "conflict") {
          return {
            eventId: item.eventId,
            result,
            message,
          }
        }
        return {
          eventId: item.eventId,
          result: "error",
          message: message ?? "Respuesta de sincronización no válida.",
        }
      } catch (error) {
        const msg = String((error as any)?.message ?? error ?? "").toLowerCase()
        if (
          msg.includes("function public.sync_attendance_events") &&
          msg.includes("does not exist")
        ) {
          await insertAttendanceLogWithRetry(item.payload)
          return { eventId: item.eventId, result: "applied" }
        }
        throw error
      }
    },
    [insertAttendanceLogWithRetry]
  )

  const syncPendingAttendanceQueue = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!user) return
      if (syncInFlightRef.current) return
      if (!opts?.force && actionInFlightRef.current) return

      syncInFlightRef.current = true
      let hasSyncedAtLeastOne = false
      const syncStartedAt = Date.now()

      try {
        let queue = pendingAttendanceQueue
        if (queue.length === 0) {
          queue = await loadPendingAttendanceQueue()
        }
        if (queue.length === 0) {
          await setAndPersistPendingAttendanceQueue([])
          return
        }

        const now = Date.now()
        const toProcess = queue.map((item) => {
          if ((item.status === "failed" || item.status === "conflict") && !opts?.force) return item
          if (item.nextRetryAt && item.nextRetryAt > now) return item
          return { ...item, status: "syncing" as const }
        })
        await setAndPersistPendingAttendanceQueue(toProcess)

        const resultQueue: PendingAttendanceEvent[] = []
        for (const item of toProcess) {
          if (item.status !== "syncing") {
            resultQueue.push(item)
            continue
          }

          try {
            const decision = await evaluateQueueSyncDecision(item)
            if (decision.kind === "drop") {
              continue
            }
            if (decision.kind === "conflict") {
              recordDiagnosticError("sync", decision.reason)
              setAttendanceDiagnostics((prev) => ({
                ...prev,
                syncConflictCount: prev.syncConflictCount + 1,
              }))
              resultQueue.push({
                ...item,
                status: "conflict",
                attempts: item.attempts + 1,
                lastError: decision.reason,
                nextRetryAt: null,
              })
              continue
            }
            const syncResult = await syncAttendanceEventOnServer(item)
            if (syncResult.result === "applied" || syncResult.result === "duplicate") {
              hasSyncedAtLeastOne = true
              continue
            }
            if (syncResult.result === "conflict") {
              const reason = syncResult.message ?? "Conflicto al sincronizar el evento pendiente."
              recordDiagnosticError("sync", reason)
              setAttendanceDiagnostics((prev) => ({
                ...prev,
                syncConflictCount: prev.syncConflictCount + 1,
              }))
              resultQueue.push({
                ...item,
                status: "conflict",
                attempts: item.attempts + 1,
                lastError: reason,
                nextRetryAt: null,
              })
              continue
            }
            throw new Error(syncResult.message ?? "Error al sincronizar evento pendiente.")
          } catch (error) {
            const attempts = item.attempts + 1
            const offlineLike = isLikelyOfflineError(error)
            recordDiagnosticError(offlineLike ? "network" : "sync", getErrorMessage(error))
            const nextRetryAt = offlineLike ? Date.now() + getRetryDelayMs(attempts) : null
            resultQueue.push({
              ...item,
              status: offlineLike ? "pending" : "failed",
              attempts,
              lastError: getErrorMessage(error),
              nextRetryAt,
            })
          }
        }

        await setAndPersistPendingAttendanceQueue(resultQueue)

        if (hasSyncedAtLeastOne) {
          setIsOffline(false)
          await loadTodayAttendance()
        }
      } finally {
        setAttendanceDiagnostics((prev) => ({
          ...prev,
          lastSyncDurationMs: Date.now() - syncStartedAt,
        }))
        syncInFlightRef.current = false
      }
    },
    [
      user,
      pendingAttendanceQueue,
      loadPendingAttendanceQueue,
      setAndPersistPendingAttendanceQueue,
      recordDiagnosticError,
      evaluateQueueSyncDecision,
      syncAttendanceEventOnServer,
      loadTodayAttendance,
    ]
  )

  const syncPendingBreakQueue = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!user) return
      if (breakSyncInFlightRef.current) return
      if (!opts?.force && actionInFlightRef.current) return

      breakSyncInFlightRef.current = true
      let hasSyncedAtLeastOne = false
      const syncStartedAt = Date.now()

      try {
        let queue = pendingBreakQueue
        if (queue.length === 0) {
          queue = await loadPendingBreakQueue()
        }
        if (queue.length === 0) {
          await setAndPersistPendingBreakQueue([])
          return
        }

        const now = Date.now()
        const toProcess = queue.map((item) => {
          if ((item.status === "failed" || item.status === "conflict") && !opts?.force) return item
          if (item.nextRetryAt && item.nextRetryAt > now) return item
          return { ...item, status: "syncing" as const }
        })
        await setAndPersistPendingBreakQueue(toProcess)

        const resultQueue: PendingBreakEvent[] = []
        for (const item of toProcess) {
          if (item.status !== "syncing") {
            resultQueue.push(item)
            continue
          }

          try {
            const decision = await evaluateBreakSyncDecision(item)
            if (decision.kind === "drop") continue
            if (decision.kind === "conflict") {
              recordDiagnosticError("sync", decision.reason)
              resultQueue.push({
                ...item,
                status: "conflict",
                attempts: item.attempts + 1,
                lastError: decision.reason,
                nextRetryAt: null,
              })
              continue
            }

            if (item.payload.action === "start") {
              const { error } = await supabase.rpc("start_attendance_break", {
                p_site_id: item.payload.site_id,
                p_source: item.payload.source,
                p_notes: item.payload.notes,
              })
              if (error) throw error
            } else {
              const { error } = await supabase.rpc("end_attendance_break", {
                p_source: item.payload.source,
                p_notes: item.payload.notes,
              })
              if (error && !isNoActiveBreakError(error)) throw error
            }
            hasSyncedAtLeastOne = true
          } catch (error) {
            const attempts = item.attempts + 1
            const offlineLike = isLikelyOfflineError(error)
            recordDiagnosticError(offlineLike ? "network" : "sync", getErrorMessage(error))
            const nextRetryAt = offlineLike ? Date.now() + getRetryDelayMs(attempts) : null
            resultQueue.push({
              ...item,
              status: offlineLike ? "pending" : "failed",
              attempts,
              lastError: getErrorMessage(error),
              nextRetryAt,
            })
          }
        }

        await setAndPersistPendingBreakQueue(resultQueue)
        if (hasSyncedAtLeastOne) {
          setIsOffline(false)
          await loadTodayAttendance()
        }
      } finally {
        setAttendanceDiagnostics((prev) => ({
          ...prev,
          lastSyncDurationMs: Date.now() - syncStartedAt,
        }))
        breakSyncInFlightRef.current = false
      }
    },
    [
      user,
      pendingBreakQueue,
      loadPendingBreakQueue,
      setAndPersistPendingBreakQueue,
      evaluateBreakSyncDecision,
      recordDiagnosticError,
      loadTodayAttendance,
    ]
  )

  const loadPendingAttendanceQueueRef = useRef(loadPendingAttendanceQueue)
  const loadPendingBreakQueueRef = useRef(loadPendingBreakQueue)
  const syncPendingAttendanceQueueRef = useRef(syncPendingAttendanceQueue)
  const syncPendingBreakQueueRef = useRef(syncPendingBreakQueue)
  const clearExpiredLatchRef = useRef(clearExpiredLatch)

  useEffect(() => {
    loadPendingAttendanceQueueRef.current = loadPendingAttendanceQueue
  }, [loadPendingAttendanceQueue])

  useEffect(() => {
    loadPendingBreakQueueRef.current = loadPendingBreakQueue
  }, [loadPendingBreakQueue])

  useEffect(() => {
    syncPendingAttendanceQueueRef.current = syncPendingAttendanceQueue
  }, [syncPendingAttendanceQueue])

  useEffect(() => {
    syncPendingBreakQueueRef.current = syncPendingBreakQueue
  }, [syncPendingBreakQueue])

  useEffect(() => {
    clearExpiredLatchRef.current = clearExpiredLatch
  }, [clearExpiredLatch])

  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      if (!user) {
        if (mounted) setPendingAttendanceQueue([])
        if (mounted) setPendingBreakQueue([])
        return
      }
      const [attendanceQueue, breakQueue] = await Promise.all([
        loadPendingAttendanceQueueRef.current(),
        loadPendingBreakQueueRef.current(),
      ])
      if (mounted) setPendingAttendanceQueue(attendanceQueue)
      if (mounted) setPendingBreakQueue(breakQueue)
      if (attendanceQueue.length > 0) {
        void syncPendingAttendanceQueueRef.current({ force: true })
      }
      if (breakQueue.length > 0) {
        void syncPendingBreakQueueRef.current({ force: true })
      }
    }
    void bootstrap()
    return () => {
      mounted = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    if (pendingAttendanceQueue.length === 0 && pendingBreakQueue.length === 0) return
    const timer = setInterval(() => {
      void syncPendingAttendanceQueueRef.current()
      void syncPendingBreakQueueRef.current()
    }, ATTENDANCE_SYNC_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [user?.id, pendingAttendanceQueue.length, pendingBreakQueue.length])

  useEffect(() => {
    if (!user) return
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        clearExpiredLatchRef.current()
        void syncPendingAttendanceQueueRef.current({ force: true })
        void syncPendingBreakQueueRef.current({ force: true })
      }
    })
    return () => sub.remove()
  }, [user?.id])

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

      const maxAccuracyMeters =
        mode === "check_out"
          ? attendancePolicy.geofence_check_out_max_accuracy_meters
          : attendancePolicy.geofence_check_in_max_accuracy_meters
      const policy = { maxAccuracyMeters }

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

      const resolveBestEffortSelectionLocation = async (): Promise<ValidatedLocation | null> => {
        if (location) return location

        try {
          const permissions = await Location.getForegroundPermissionsAsync()
          if (permissions.status !== "granted") {
            const requested = await Location.requestForegroundPermissionsAsync()
            if (requested.status !== "granted") return null
          }
        } catch {
          return null
        }

        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 2 * 60 * 1000,
            requiredAccuracy: 150,
          })
          if (lastKnown) {
            return buildValidatedLocationFromRaw(lastKnown)
          }
        } catch {
          // Best-effort only: if last known position is unavailable, continue silently.
        }

        try {
          const currentPosition = (await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              mayShowUserSettingsDialog: true,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("TIMEOUT")), 7000)
            ),
          ])) as Location.LocationObject

          if (currentPosition?.coords) {
            return buildValidatedLocationFromRaw(currentPosition)
          }
        } catch {
          // Best-effort only: if active GPS fix fails, caller will show "distancia no disponible".
        }

        return null
      }

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
              : null

          return {
            id: item.siteId,
            name: item.siteName,
            distanceMeters: distance,
            effectiveRadiusMeters: effectiveRadius,
            requiresGeolocation: hasCoordinates,
          }
        })

      if (mode === "check_out") {
        // Check-out siempre usa la sede del último check-in abierto.
        siteId = args?.siteId ?? lastLog?.site_id ?? null
      } else {
        // Check-in: en multi-sede siempre se exige selección explícita.
        if (args?.siteId) {
          siteId = args.siteId
        } else if (employeeSites.length > 1) {
          if (effectiveSelectedSiteId) {
            siteId = effectiveSelectedSiteId
          } else {
            const selectionLocation = await resolveBestEffortSelectionLocation()
            const next: GeofenceCheckState = {
              status: "blocked",
              canProceed: false,
              mode,
              lastUpdateSource: updateSource,
              siteId: null,
              siteName: null,
              distanceMeters: null,
              accuracyMeters: selectionLocation?.accuracy ?? null,
              effectiveRadiusMeters: null,
              message: "Selecciona una sede para continuar",
              updatedAt: now,
              location: selectionLocation ?? null,
              deviceInfo: buildDeviceInfoPayload(selectionLocation ?? null),
              requiresSelection: true,
              candidateSites: buildSelectionCandidates(selectionLocation ?? null),
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
        now - cached.updatedAt <= attendancePolicy.geofence_ready_cache_ms

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
        const latched = canReuseRecentReadyGeofence(mode, siteId)
        if (latched) {
          const next = buildLatchedReadyState(latched, updateSource, "network")
          geofenceCacheRef.current = next
          setGeofenceState(next)
          return next
        }
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
          isLatchedReady: false,
          latchedReason: null,
          latchExpiresAt: null,
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
          recordDiagnosticError(
            classifyDiagnosticStage(locationResult.error ?? null),
            String(locationResult.error ?? "Ubicación requerida para continuar")
          )
          const transientLocationIssue =
            isLikelyTransientGeoError(locationResult.error ?? null) ||
            isLikelyOfflineError(locationResult.error ?? null)
          if (transientLocationIssue) {
            const latched = canReuseRecentReadyGeofence(mode, site.id)
            if (latched) {
              const next = buildLatchedReadyState(latched, updateSource, "location")
              geofenceCacheRef.current = next
              setGeofenceState(next)
              return next
            }
          }
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
          message: `Precisión GPS insuficiente (${Math.round(
            acc
          )}m). Debe ser <= ${policy.maxAccuracyMeters}m para registrar.`,
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
          message: `Estás a ${Math.round(distance)}m y la precisión es ${Math.round(
            acc
          )}m. Validación real: ${Math.round(distance + acc)}m <= ${effectiveRadius}m.`,
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
        isLatchedReady: false,
        latchedReason: null,
        latchExpiresAt: null,
        requiresSelection: false,
        candidateSites: null,
      }

      geofenceCacheRef.current = next
      setGeofenceState(next)
      return next

      } catch (error) {
        // Catch-all para evitar que se quede en "checking" para siempre
        console.error('[refreshGeofence] Error no manejado:', error)
        recordDiagnosticError(classifyDiagnosticStage(error), getErrorMessage(error))
        if (isLikelyOfflineError(error)) {
          const latched = canReuseRecentReadyGeofence(mode, siteId)
          if (latched) {
            const next = buildLatchedReadyState(latched, updateSource, "network")
            geofenceCacheRef.current = next
            setGeofenceState(next)
            return next
          }
        }
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
    [
      user,
      employee,
      employeeSites,
      selectedSiteId,
      attendancePolicy.geofence_check_in_max_accuracy_meters,
      attendancePolicy.geofence_check_out_max_accuracy_meters,
      attendancePolicy.geofence_ready_cache_ms,
      getLastAttendanceLog,
      resolveSite,
      canReuseRecentReadyGeofence,
      buildLatchedReadyState,
      recordDiagnosticError,
    ]
  )

  const checkIn = useCallback(async (): Promise<CheckInOutResult> => {
    if (!user || !employee) return { success: false, error: "No autenticado" }
    if (!employee.isActive) return { success: false, error: "Tu cuenta está inactiva" }
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const hasPendingSameDayCheckOut = pendingAttendanceQueue.some((item) => {
      if (item.payload.action !== "check_out") return false
      const ts = new Date(item.payload.occurred_at).getTime()
      return Number.isFinite(ts) && ts >= startOfDay.getTime()
    })
    if (hasPendingSameDayCheckOut) {
      return {
        success: false,
        error: "Tienes una salida pendiente de hoy. Sincronízala antes de iniciar una nueva entrada.",
      }
    }

    const lastLog = await getLastAttendanceLog()
    if (lastLog?.action === "check_in") {
      return { success: false, error: "Ya tienes un check-in activo" }
    }

    if (actionInFlightRef.current) return { success: false, error: "Acción en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)
    const checkInStartedAt = Date.now()
    const geofenceStartedAt = Date.now()
    let lastGeo: GeofenceCheckState | null = null

    try {
      // Asegurar que el geofence esté listo antes de proceder
      // En producción, el geofence puede tardar más en verificarse
      let geo = await refreshGeofence({ force: false, mode: "check_in", source: "check_action" })
      if (!geo.canProceed) {
        geo = await refreshGeofence({ force: true, mode: "check_in", source: "check_action" })
      }
      
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
        const cachedReady = canReuseRecentReadyGeofence("check_in")
        if (cachedReady) {
          geo = cachedReady
        }
      }
      setAttendanceDiagnostics((prev) => ({
        ...prev,
        lastGeofenceDurationMs: Date.now() - geofenceStartedAt,
      }))
      lastGeo = geo

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
      const clientEventId = buildClientEventId("check_in")

      const shiftId =
        (await getTodayShiftIdForSite(user.id, geo.siteId)) ?? undefined

      const payload: AttendanceInsertPayload = {
        employee_id: user.id,
        site_id: geo.siteId,
        action: "check_in",
        source: getAttendanceSource(),
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy_meters: location?.accuracy ?? null,
        device_info: {
          ...(deviceInfo ?? {}),
          clientEventId,
        },
        notes: null,
        occurred_at: new Date().toISOString(),
        ...(shiftId ? { shift_id: shiftId } : {}),
      }

      await insertAttendanceLogWithRetry(payload)

      setIsOffline(false)

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      await loadTodayAttendance()
      setAttendanceDiagnostics((prev) => ({
        ...prev,
        lastCheckInDurationMs: Date.now() - checkInStartedAt,
      }))

      return { success: true, timestamp: new Date().toISOString() }
    } catch (err) {
      const offline = isLikelyOfflineError(err)
      const friendly = !offline ? getAttendanceErrorMessage(err, "check_in") : null
      if (friendly) {
        console.warn("Check-in blocked:", friendly, err)
      } else {
        console.error("Check-in error:", err)
      }
      recordDiagnosticError(
        offline ? "network" : classifyDiagnosticStage(err),
        friendly ?? getErrorMessage(err)
      )
      setIsOffline(offline)
      const latchValid =
        !!lastGeo?.siteId && (!!lastGeo?.canProceed || isLatchValidFor(lastGeo.siteId))
      if (
        lastGeo?.siteId &&
        canQueueByPolicy({ networkError: offline, latchValid, eventType: "check_in" })
      ) {
        const clientEventId = buildClientEventId("check_in")
        const shiftId =
          (await getTodayShiftIdForSite(user.id, lastGeo.siteId)) ?? undefined
        const payload: AttendanceInsertPayload = {
          employee_id: user.id,
          site_id: lastGeo.siteId,
          action: "check_in",
          source: getAttendanceSource(),
          latitude: lastGeo.location?.latitude ?? null,
          longitude: lastGeo.location?.longitude ?? null,
          accuracy_meters: lastGeo.location?.accuracy ?? null,
          device_info: {
            ...(lastGeo.deviceInfo ?? {}),
            clientEventId,
            queuedAt: new Date().toISOString(),
          },
          notes: null,
          occurred_at: new Date().toISOString(),
          ...(shiftId ? { shift_id: shiftId } : {}),
        }
        await enqueuePendingAttendanceEvent(payload, err)
        applyOptimisticAttendanceUpdate(payload, lastGeo.siteName ?? null)
        return {
          success: true,
          queued: true,
          timestamp: payload.occurred_at,
        }
      }
      return {
        success: false,
        error: offline
          ? getUserFacingAttendanceError(err).message
          : friendly ?? getUserFacingAttendanceError(err, "Error al registrar entrada").message,
      }
    } finally {
      actionInFlightRef.current = false
      setIsLoading(false)
    }
  }, [
    user,
    employee,
    pendingAttendanceQueue,
    getLastAttendanceLog,
    getTodayShiftIdForSite,
    refreshGeofence,
    canReuseRecentReadyGeofence,
    canQueueByPolicy,
    isLatchValidFor,
    insertAttendanceLogWithRetry,
    enqueuePendingAttendanceEvent,
    applyOptimisticAttendanceUpdate,
    recordDiagnosticError,
    loadTodayAttendance,
  ])

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
    const checkOutStartedAt = Date.now()
    const geofenceStartedAt = Date.now()
    let lastGeo: GeofenceCheckState | null = null

    try {
      const siteIdToClose = lastLog.site_id
      if (pendingBreakQueue.length > 0) {
        await syncPendingBreakQueue({ force: true })
        const remainingBreaks = await loadPendingBreakQueue()
        if (remainingBreaks.length > 0) {
          const failedCount = remainingBreaks.filter((i) => i.status === "failed").length
          return {
            success: false,
            error:
              failedCount > 0
                ? "Tienes descansos pendientes con conflicto. Sincroniza o revisa antes de cerrar turno."
                : "Estamos sincronizando descansos pendientes. Intenta cerrar turno de nuevo en unos segundos.",
          }
        }
      }

      let geo = await refreshGeofence({
        force: false,
        mode: "check_out",
        siteId: siteIdToClose,
        source: "check_action",
      })
      if (!geo.canProceed) {
        geo = await refreshGeofence({
          force: true,
          mode: "check_out",
          siteId: siteIdToClose,
          source: "check_action",
        })
      }
      if (!geo.canProceed) {
        const cachedReady = canReuseRecentReadyGeofence("check_out", siteIdToClose)
        if (cachedReady) {
          geo = cachedReady
        }
      }
      setAttendanceDiagnostics((prev) => ({
        ...prev,
        lastGeofenceDurationMs: Date.now() - geofenceStartedAt,
      }))
      lastGeo = geo
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
          if (isLikelyOfflineError(breakCloseError)) {
            const nowIso = new Date().toISOString()
            const clientEventId = buildClientEventId("break_end")
            await enqueuePendingBreakEvent(
              {
                action: "end",
                site_id: siteIdToClose,
                source: getAttendanceSource(),
                notes: JSON.stringify({
                  clientEventId,
                  queuedAt: nowIso,
                  reason: "Cierre automático por check-out",
                }),
                clientEventId,
                queuedAt: nowIso,
              },
              breakCloseError
            )
            applyOptimisticBreakUpdate("end", nowIso)

            const queuedCheckoutEventId = buildClientEventId("check_out")
            const queuedPayload: AttendanceInsertPayload = {
              employee_id: user.id,
              site_id: siteIdToClose,
              action: "check_out",
              source: getAttendanceSource(),
              latitude: geo.location?.latitude ?? null,
              longitude: geo.location?.longitude ?? null,
              accuracy_meters: geo.location?.accuracy ?? null,
              device_info: {
                ...(geo.deviceInfo ?? {}),
                clientEventId: queuedCheckoutEventId,
                queuedAt: nowIso,
                dependsOnBreakEnd: clientEventId,
              },
              notes: null,
              occurred_at: nowIso,
              ...(lastLog.shift_id ? { shift_id: lastLog.shift_id } : {}),
            }
            await enqueuePendingAttendanceEvent(queuedPayload, breakCloseError)
            applyOptimisticAttendanceUpdate(queuedPayload, lastLog.site_name ?? null)
            setIsOffline(true)
            return { success: true, queued: true, timestamp: nowIso }
          }
          throw breakCloseError
        }
      }

      const location = geo.location
      const deviceInfo = geo.deviceInfo
      const clientEventId = buildClientEventId("check_out")

      const payload: AttendanceInsertPayload = {
        employee_id: user.id,
        site_id: siteIdToClose,
        action: "check_out",
        source: getAttendanceSource(),
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy_meters: location?.accuracy ?? null,
        device_info: {
          ...(deviceInfo ?? {}),
          clientEventId,
        },
        notes: null,
        occurred_at: new Date().toISOString(),
        ...(lastLog.shift_id ? { shift_id: lastLog.shift_id } : {}),
      }

      await insertAttendanceLogWithRetry(payload)

      setIsOffline(false)

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      await loadTodayAttendance()
      setAttendanceDiagnostics((prev) => ({
        ...prev,
        lastCheckOutDurationMs: Date.now() - checkOutStartedAt,
      }))

      return { success: true, timestamp: new Date().toISOString() }
    } catch (err) {
      const offline = isLikelyOfflineError(err)
      const friendly = !offline ? getAttendanceErrorMessage(err, "check_out") : null
      if (friendly) {
        console.warn("Check-out blocked:", friendly, err)
      } else {
        console.error("Check-out error:", err)
      }
      recordDiagnosticError(
        offline ? "network" : classifyDiagnosticStage(err),
        friendly ?? getErrorMessage(err)
      )
      setIsOffline(offline)
      const latchValid =
        !!lastGeo?.siteId && (!!lastGeo?.canProceed || isLatchValidFor(lastGeo.siteId))
      if (
        lastGeo?.siteId &&
        canQueueByPolicy({ networkError: offline, latchValid, eventType: "check_out" })
      ) {
        const clientEventId = buildClientEventId("check_out")
        const payload: AttendanceInsertPayload = {
          employee_id: user.id,
          site_id: lastLog.site_id,
          action: "check_out",
          source: getAttendanceSource(),
          latitude: lastGeo.location?.latitude ?? null,
          longitude: lastGeo.location?.longitude ?? null,
          accuracy_meters: lastGeo.location?.accuracy ?? null,
          device_info: {
            ...(lastGeo.deviceInfo ?? {}),
            clientEventId,
            queuedAt: new Date().toISOString(),
          },
          notes: null,
          occurred_at: new Date().toISOString(),
          ...(lastLog.shift_id ? { shift_id: lastLog.shift_id } : {}),
        }
        await enqueuePendingAttendanceEvent(payload, err)
        applyOptimisticAttendanceUpdate(payload, lastLog.site_name ?? null)
        return {
          success: true,
          queued: true,
          timestamp: payload.occurred_at,
        }
      }
      return {
        success: false,
        error: offline
          ? getUserFacingAttendanceError(err).message
          : friendly ?? getUserFacingAttendanceError(err, "Error al registrar salida").message,
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
    canReuseRecentReadyGeofence,
    canQueueByPolicy,
    isLatchValidFor,
    insertAttendanceLogWithRetry,
    enqueuePendingAttendanceEvent,
    enqueuePendingBreakEvent,
    applyOptimisticBreakUpdate,
    applyOptimisticAttendanceUpdate,
    recordDiagnosticError,
    loadTodayAttendance,
    pendingBreakQueue.length,
    syncPendingBreakQueue,
    loadPendingBreakQueue,
    attendanceState.isOnBreak,
    attendanceState.openBreakStartAt,
  ])

  const startBreak = useCallback(async (): Promise<CheckInOutResult> => {
    if (!user || !employee) return { success: false, error: "No autenticado" }
    if (!employee.isActive) return { success: false, error: "Tu cuenta está inactiva" }
    if (attendanceState.isOnBreak) return { success: false, error: "Ya tienes un descanso activo" }
    const hasPendingCheckOut = pendingAttendanceQueue.some(
      (item) => item.payload.action === "check_out"
    )
    if (hasPendingCheckOut) {
      return {
        success: false,
        error: "Tienes una salida pendiente de sincronizar. Espera a que se sincronice antes de iniciar descanso.",
      }
    }

    const lastLog = await getLastAttendanceLog()
    if (!lastLog || lastLog.action !== "check_in") {
      return { success: false, error: "Debes iniciar turno antes de tomar descanso" }
    }

    if (actionInFlightRef.current) return { success: false, error: "Acción en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)

    try {
      const clientEventId = buildClientEventId("break_start")
      const { error } = await supabase.rpc("start_attendance_break", {
        p_site_id: lastLog.site_id,
        p_source: getAttendanceSource(),
        p_notes: JSON.stringify({ clientEventId }),
      })
      if (error) throw error

      setIsOffline(false)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await loadTodayAttendance()
      return { success: true, timestamp: new Date().toISOString() }
    } catch (err) {
      const offline = isLikelyOfflineError(err)
      setIsOffline(offline)
      if (offline) {
        const nowIso = new Date().toISOString()
        const clientEventId = buildClientEventId("break_start")
        await enqueuePendingBreakEvent(
          {
            action: "start",
            site_id: lastLog.site_id,
            source: getAttendanceSource(),
            notes: JSON.stringify({
              clientEventId,
              queuedAt: nowIso,
            }),
            clientEventId,
            queuedAt: nowIso,
          },
          err
        )
        applyOptimisticBreakUpdate("start", nowIso)
        return { success: true, queued: true, timestamp: nowIso }
      }
      return {
        success: false,
        error: offline
          ? getUserFacingAttendanceError(err).message
          : String(
              (err as any)?.message ??
                getUserFacingAttendanceError(err, "No se pudo iniciar el descanso").message
            ),
      }
    } finally {
      actionInFlightRef.current = false
      setIsLoading(false)
    }
  }, [
    user,
    employee,
    attendanceState.isOnBreak,
    pendingAttendanceQueue,
    getLastAttendanceLog,
    enqueuePendingBreakEvent,
    applyOptimisticBreakUpdate,
    loadTodayAttendance,
  ])

  const endBreak = useCallback(async (): Promise<CheckInOutResult> => {
    if (!user || !employee) return { success: false, error: "No autenticado" }
    if (!employee.isActive) return { success: false, error: "Tu cuenta está inactiva" }
    const hasPendingCheckIn = pendingAttendanceQueue.some(
      (item) => item.payload.action === "check_in"
    )
    const hasPendingCheckOut = pendingAttendanceQueue.some(
      (item) => item.payload.action === "check_out"
    )
    const hasActiveShiftContext =
      attendanceState.status === "checked_in" || (hasPendingCheckIn && !hasPendingCheckOut)

    if (!hasActiveShiftContext) {
      return {
        success: false,
        error: "No hay turno activo para finalizar descanso.",
      }
    }
    if (hasPendingCheckOut) {
      return {
        success: false,
        error: "Tienes una salida pendiente de sincronizar. Espera antes de finalizar descanso.",
      }
    }

    if (actionInFlightRef.current) return { success: false, error: "Acción en curso. Intenta de nuevo." }
    actionInFlightRef.current = true
    setIsLoading(true)

    try {
      const clientEventId = buildClientEventId("break_end")
      const { error } = await supabase.rpc("end_attendance_break", {
        p_source: getAttendanceSource(),
        p_notes: JSON.stringify({ clientEventId }),
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
      if (offline) {
        const nowIso = new Date().toISOString()
        const clientEventId = buildClientEventId("break_end")
        await enqueuePendingBreakEvent(
          {
            action: "end",
            site_id: null,
            source: getAttendanceSource(),
            notes: JSON.stringify({
              clientEventId,
              queuedAt: nowIso,
            }),
            clientEventId,
            queuedAt: nowIso,
          },
          err
        )
        applyOptimisticBreakUpdate("end", nowIso)
        return { success: true, queued: true, timestamp: nowIso }
      }
      return {
        success: false,
        error: offline
          ? getUserFacingAttendanceError(err).message
          : noBreak
            ? "No tienes un descanso activo"
            : String(
                (err as any)?.message ??
                  getUserFacingAttendanceError(err, "No se pudo finalizar el descanso").message
              ),
      }
    } finally {
      actionInFlightRef.current = false
      setIsLoading(false)
    }
  }, [
    user,
    employee,
    pendingAttendanceQueue,
    attendanceState.status,
    enqueuePendingBreakEvent,
    applyOptimisticBreakUpdate,
    loadTodayAttendance,
  ])

  const registerOpenShiftDepartureEvent = useCallback(
    async (location: ValidatedLocation) => {
      if (!user || !employee) return
      if (attendanceState.status !== "checked_in") return
      if (attendanceState.isOnBreak) return
      if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        return
      }

      const now = Date.now()
      if (
        now - departureLastCheckAtRef.current <
        attendancePolicy.shift_departure_min_check_interval_ms
      ) {
        return
      }
      departureLastCheckAtRef.current = now

      const accuracy = location.accuracy ?? 999
      if (accuracy > attendancePolicy.shift_departure_max_accuracy_meters) return

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
      const isOutside =
        distanceMeters + accuracy >= attendancePolicy.shift_departure_threshold_meters
      if (!isOutside) return

      departureEventInFlightRef.current = true
      try {
        const occurredAtIso = new Date(Math.min(location.timestamp ?? now, now)).toISOString()
        let data: unknown = null
        let error: unknown = null

        const autoCloseResult = await supabase.rpc("register_shift_departure_event_autoclose", {
          p_site_id: lastLog.site_id,
          p_distance_meters: Math.round(distanceMeters),
          p_accuracy_meters: Math.round(accuracy),
          p_source: getAttendanceSource(),
          p_notes: null,
          p_occurred_at: occurredAtIso,
          p_auto_checkout_threshold_meters: attendancePolicy.shift_departure_threshold_meters,
        })
        data = autoCloseResult.data
        error = autoCloseResult.error

        const errorMsg = String((error as any)?.message ?? "").toLowerCase()
        if (error && errorMsg.includes("function public.register_shift_departure_event_autoclose")) {
          const fallbackResult = await supabase.rpc("register_shift_departure_event", {
            p_site_id: lastLog.site_id,
            p_distance_meters: Math.round(distanceMeters),
            p_accuracy_meters: Math.round(accuracy),
            p_source: getAttendanceSource(),
            p_notes: null,
            p_occurred_at: occurredAtIso,
          })
          data = fallbackResult.data
          error = fallbackResult.error
        }

        if (error) {
          console.warn("[ATTENDANCE] No se pudo registrar evento de salida de sede:", error)
          return
        }

        const payload = (data as {
          inserted?: boolean
          reason?: string | null
          auto_checkout_applied?: boolean
          auto_checkout_reason?: string | null
        } | null) ?? null

        const autoCheckoutApplied = payload?.auto_checkout_applied === true
        if (autoCheckoutApplied) {
          departureLoggedShiftKeyRef.current = shiftKey
          if (departureAutoCheckoutNotifiedShiftRef.current !== shiftKey) {
            departureAutoCheckoutNotifiedShiftRef.current = shiftKey
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            Alert.alert(
              "Turno cerrado automáticamente",
              "Detectamos que te alejaste de la sede sin estar en descanso. Se registró salida automática."
            )
          }
          await loadTodayAttendance()
          return
        }

        // Si ya no hay turno abierto o el evento quedó registrado antes, evitamos ruido local.
        if (payload?.reason === "no_open_shift" || payload?.reason === "on_break") {
          departureLoggedShiftKeyRef.current = shiftKey
          return
        }

        if (payload?.reason === "already_recorded") {
          // Mantener monitoreo activo; el backend puede autocerrar en un intento posterior.
          console.warn(
            "[ATTENDANCE] Evento de salida ya existía pero aún no hubo auto check-out. Seguimos monitoreando."
          )
          return
        }

        if (payload?.inserted && !autoCheckoutApplied) {
          console.warn(
            "[ATTENDANCE] Evento de salida registrado sin auto check-out aplicado. Se reintentará automáticamente."
          )
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
      attendancePolicy.shift_departure_min_check_interval_ms,
      attendancePolicy.shift_departure_max_accuracy_meters,
      attendancePolicy.shift_departure_threshold_meters,
      getLastAttendanceLog,
      resolveSite,
      loadTodayAttendance,
    ],
  )

  const refreshGeofenceRealtimeRef = useRef(refreshGeofence)
  const registerOpenShiftDepartureEventRef = useRef(registerOpenShiftDepartureEvent)

  useEffect(() => {
    refreshGeofenceRealtimeRef.current = refreshGeofence
  }, [refreshGeofence])

  useEffect(() => {
    registerOpenShiftDepartureEventRef.current = registerOpenShiftDepartureEvent
  }, [registerOpenShiftDepartureEvent])

  const startRealtimeGeofence = useCallback(async () => {
    if (realtimeWatchRef.current) return
    const isCheckedInNow = attendanceState.status === "checked_in"

    let permission = await Location.getForegroundPermissionsAsync()
    if (permission.status !== "granted" && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync()
    }
    if (permission.status !== "granted") return

    const isEnabled = await Location.hasServicesEnabledAsync()
    if (!isEnabled) return

    const watchOptions: Location.LocationOptions = isCheckedInNow
      ? {
          // Modo ahorro para jornada activa (menos consumo en gama media).
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 20,
          mayShowUserSettingsDialog: true,
        }
      : {
          // Antes de check-in priorizamos mejor precisión, pero sin ir al máximo constante.
          accuracy: Location.Accuracy.High,
          timeInterval: 6000,
          distanceInterval: 10,
          mayShowUserSettingsDialog: true,
        }

    const subscription = await Location.watchPositionAsync(
      watchOptions,
      (rawLocation) => {
        const now = Date.now()
        const minTickMs = isCheckedInNow ? 4000 : 2500
        if (now - lastRealtimeTickRef.current < minTickMs) return
        lastRealtimeTickRef.current = now

        const validated = buildValidatedLocationFromRaw(rawLocation)
        void refreshGeofenceRealtimeRef.current({
          force: true,
          location: validated,
          silent: true,
          source: "auto",
        })
        void registerOpenShiftDepartureEventRef.current(validated)
      }
    )

    realtimeWatchRef.current = subscription
  }, [attendanceState.status])

  const stopRealtimeGeofence = useCallback(() => {
    if (realtimeWatchRef.current) {
      realtimeWatchRef.current.remove()
      realtimeWatchRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopRealtimeGeofence()
  }, [stopRealtimeGeofence])

  useEffect(() => {
    // Si cambia estado de turno, reiniciar watcher para aplicar nuevo perfil.
    if (!realtimeWatchRef.current) return
    stopRealtimeGeofence()
    void startRealtimeGeofence()
  }, [attendanceState.status, startRealtimeGeofence, stopRealtimeGeofence])

  const selectSiteForCheckIn = useCallback(
    async (siteId: string) => {
      await setSelectedSite(siteId)
      await refreshGeofence({ force: true, mode: "check_in", siteId, source: "user" })
    },
    [refreshGeofence, setSelectedSite]
  )

  const pendingAnyCount = pendingAttendanceQueue.length + pendingBreakQueue.length
  const syncingAnyCount =
    pendingAttendanceQueue.filter((i) => i.status === "syncing").length +
    pendingBreakQueue.filter((i) => i.status === "syncing").length
  const failedAnyCount =
    pendingAttendanceQueue.filter((i) => i.status === "failed" || i.status === "conflict").length +
    pendingBreakQueue.filter((i) => i.status === "failed" || i.status === "conflict").length

  const attendanceUxState = useMemo<AttendanceUxState>(() => {
    if (geofenceState.status === "checking") return "checking"
    if (syncingAnyCount > 0) return "syncing"
    if (failedAnyCount > 0) return "failed"
    if (pendingAnyCount > 0) return "queued"
    if (geofenceState.status === "blocked" || geofenceState.status === "error") return "blocked"
    return "ready"
  }, [failedAnyCount, geofenceState.status, pendingAnyCount, syncingAnyCount])

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
    pendingAttendanceCount: pendingAttendanceQueue.length,
    pendingAttendanceSyncingCount: pendingAttendanceQueue.filter((i) => i.status === "syncing").length,
    pendingAttendanceFailedCount: pendingAttendanceQueue.filter((i) => i.status === "failed").length,
    pendingAttendanceConflictCount: pendingAttendanceQueue.filter(
      (i) =>
        i.status === "conflict" ||
        (i.status === "failed" && String(i.lastError ?? "").toLowerCase().includes("conflicto"))
    ).length,
    pendingAttendanceNextRetryAt:
      pendingAttendanceQueue
        .map((i) => i.nextRetryAt)
        .filter((v): v is number => typeof v === "number")
        .sort((a, b) => a - b)[0] ?? null,
    pendingAttendanceLastError:
      [...pendingAttendanceQueue]
        .reverse()
        .find((i) => !!i.lastError)?.lastError ?? null,
    pendingAttendanceOldestCreatedAt:
      [...pendingAttendanceQueue]
        .map((i) => i.createdAt)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0] ?? null,
    pendingBreakCount: pendingBreakQueue.length,
    pendingBreakSyncingCount: pendingBreakQueue.filter((i) => i.status === "syncing").length,
    pendingBreakFailedCount: pendingBreakQueue.filter(
      (i) => i.status === "failed" || i.status === "conflict"
    ).length,
    attendanceUxState,
    attendanceUxMessage: ATTENDANCE_UX_MESSAGES[attendanceUxState],
    attendanceDiagnostics,
    syncPendingAttendanceQueue,
    syncPendingBreakQueue,
    selectSiteForCheckIn,
    startRealtimeGeofence,
    stopRealtimeGeofence,
  }
}
