import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Haptics from "expo-haptics"
import * as Location from "expo-location"
import { Alert, AppState } from "react-native"

import {
  evaluateAttendanceQueueSyncDecision,
  evaluateBreakQueueSyncDecision,
} from "@/hooks/attendance/queue-decisions"
import { ensureActionGeofenceReady } from "@/hooks/attendance/action-geofence"
import {
  buildAttendanceInsertPayload,
  buildQueuedBreakPayload,
} from "@/hooks/attendance/action-payloads"
import {
  endAttendanceBreakOnServer,
  startAttendanceBreakOnServer,
} from "@/hooks/attendance/break-rpc"
import {
  buildLatchedReadyGeofenceState,
  canReuseRecentReadyGeofenceState,
  clearExpiredGeofenceLatch,
  isGeofenceLatchValidFor,
  setLatchFromGeofenceSuccess,
} from "@/hooks/attendance/geofence-latch"
import {
  buildGeofenceBlockedState,
  buildGeofenceErrorState,
} from "@/hooks/attendance/geofence-state"
import {
  buildSelectionCandidates,
  resolveAttendanceSite,
  resolveBestEffortSelectionLocation,
} from "@/hooks/attendance/geofence-site"
import { resolveGeofenceTarget } from "@/hooks/attendance/geofence-target"
import {
  buildResolvedSitePreflightState,
  validateResolvedSiteGeofence,
} from "@/hooks/attendance/geofence-validation"
import { useRealtimeGeofence } from "@/hooks/attendance/use-realtime-geofence"
import { useShiftDepartureTracking } from "@/hooks/attendance/use-shift-departure-tracking"
import {
  runAttendanceQueueSync,
  runBreakQueueSync,
  syncAttendanceEventOnServer as syncAttendanceEventOnServerHelper,
} from "@/hooks/attendance/queue-sync"
import {
  loadPendingAttendanceQueueFromStorage,
  loadPendingBreakQueueFromStorage,
  persistPendingAttendanceQueueToStorage,
  persistPendingBreakQueueToStorage,
} from "@/hooks/attendance/queue-storage"
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
import {
  asMillis,
  ATTENDANCE_GEOFENCE,
  ATTENDANCE_RECONCILE_WINDOW_MS,
  ATTENDANCE_SYNC_INTERVAL_MS,
  ATTENDANCE_SYNC_MAX_RETRY_DELAY_MS,
  ATTENDANCE_UX_MESSAGES,
  ATTENDANCE_WRITE_BASE_DELAY_MS,
  ATTENDANCE_WRITE_MAX_ATTEMPTS,
  AttendanceBreakRow,
  AttendanceDiagnostics,
  AttendanceInsertPayload,
  AttendanceLogRow,
  AttendanceState,
  AttendanceStatus,
  AttendanceUxState,
  buildClientEventId,
  buildDeviceInfoPayload,
  buildGeoSnapshotFromPayload,
  buildPendingAttendanceId,
  CheckInOutResult,
  classifyDiagnosticStage,
  DiagnosticStage,
  findBlockingGeoWarning,
  GeofenceCheckState,
  GeofenceLatchState,
  GeofenceMode,
  getAttendanceErrorMessage,
  getAttendanceSource,
  getErrorMessage,
  getGeofenceLatchTtlMs,
  getOverlapMinutes,
  getRetryDelayMs,
  GEOFENCE_LATCH_TTL_CHECKIN_MS,
  GEOFENCE_LATCH_TTL_CHECKOUT_MS,
  GEOFENCE_READY_CACHE_MS,
  isLikelyOfflineError,
  isLikelyTransientGeoError,
  isNoActiveBreakError,
  PendingAttendanceEvent,
  PendingAttendanceEventType,
  PendingBreakAction,
  PendingBreakEvent,
  PendingBreakPayload,
  QueueSyncDecision,
  SHIFT_DEPARTURE_TRACKING,
  SITE_RESOLVE_CACHE_MS,
  SiteCandidate,
  sleep,
  SyncResultItem,
} from "@/hooks/attendance/shared"
import { useAttendancePolicy } from "@/hooks/use-attendance-policy"

export type { SiteCandidate } from "@/hooks/attendance/shared"

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
  const geofenceCacheRef = useRef<GeofenceCheckState | null>(null)
  const geofenceLatchRef = useRef<GeofenceLatchState | null>(null)
  const siteResolveCacheRef = useRef<
    Map<string, { site: SiteCoordinates; hasCoordinates: boolean; cachedAt: number }>
  >(new Map())
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

  const resolveSite = useCallback(
    async (siteId: string): Promise<{ site: SiteCoordinates | null; hasCoordinates: boolean }> => {
      return resolveAttendanceSite({
        siteId,
        employeeSites,
        cache: siteResolveCacheRef.current,
        cacheMs: SITE_RESOLVE_CACHE_MS,
      })
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
    return loadPendingAttendanceQueueFromStorage(user.id, recordDiagnosticError)
  }, [recordDiagnosticError, user])

  const persistPendingAttendanceQueue = useCallback(
    async (queue: PendingAttendanceEvent[]) => {
      if (!user) return
      await persistPendingAttendanceQueueToStorage(user.id, queue, recordDiagnosticError)
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
    return loadPendingBreakQueueFromStorage(user.id, recordDiagnosticError)
  }, [recordDiagnosticError, user])

  const persistPendingBreakQueue = useCallback(
    async (queue: PendingBreakEvent[]) => {
      if (!user) return
      await persistPendingBreakQueueToStorage(user.id, queue, recordDiagnosticError)
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

  const setLatchFromSuccess = useCallback(
    (state: GeofenceCheckState) => {
      setLatchFromGeofenceSuccess(
        geofenceLatchRef,
        state,
        attendancePolicy.geofence_latch_ttl_checkin_ms,
        attendancePolicy.geofence_latch_ttl_checkout_ms
      )
    },
    [attendancePolicy.geofence_latch_ttl_checkin_ms, attendancePolicy.geofence_latch_ttl_checkout_ms]
  )

  const clearExpiredLatch = useCallback(() => {
    clearExpiredGeofenceLatch(geofenceLatchRef)
  }, [])

  const isLatchValidFor = useCallback((siteId?: string | null): boolean => {
    return isGeofenceLatchValidFor(geofenceLatchRef, siteId)
  }, [])

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
      return canReuseRecentReadyGeofenceState(
        geofenceCacheRef,
        mode,
        attendancePolicy.geofence_latch_ttl_checkin_ms,
        attendancePolicy.geofence_latch_ttl_checkout_ms,
        siteId,
        maxAgeMs
      )
    },
    [attendancePolicy.geofence_latch_ttl_checkin_ms, attendancePolicy.geofence_latch_ttl_checkout_ms]
  )

  const buildLatchedReadyState = useCallback(
    (
      cachedReady: GeofenceCheckState,
      source: "auto" | "user" | "check_action",
      reason: "network" | "location"
    ): GeofenceCheckState => {
      return buildLatchedReadyGeofenceState(
        cachedReady,
        source,
        reason,
        attendancePolicy.geofence_latch_ttl_checkin_ms,
        attendancePolicy.geofence_latch_ttl_checkout_ms
      )
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
      return evaluateBreakQueueSyncDecision(item, last, openBreak)
    },
    [getLastAttendanceLog, getOpenBreak]
  )

  const evaluateQueueSyncDecision = useCallback(
    async (item: PendingAttendanceEvent): Promise<QueueSyncDecision> => {
      const last = await getLastAttendanceLog()
      return evaluateAttendanceQueueSyncDecision(item, last)
    },
    [getLastAttendanceLog]
  )

  const syncAttendanceEventOnServer = useCallback(
    async (item: PendingAttendanceEvent): Promise<SyncResultItem> =>
      syncAttendanceEventOnServerHelper({
        item,
        insertAttendanceLogWithRetry,
      }),
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

        const { hasSyncedAtLeastOne: synced } = await runAttendanceQueueSync({
          queue,
          force: opts?.force,
          evaluateDecision: evaluateQueueSyncDecision,
          persistQueue: setAndPersistPendingAttendanceQueue,
          syncEvent: syncAttendanceEventOnServer,
          recordDiagnosticError,
          incrementSyncConflictCount: () =>
            setAttendanceDiagnostics((prev) => ({
              ...prev,
              syncConflictCount: prev.syncConflictCount + 1,
            })),
        })
        hasSyncedAtLeastOne = synced

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

        const { hasSyncedAtLeastOne: synced } = await runBreakQueueSync({
          queue,
          force: opts?.force,
          evaluateDecision: evaluateBreakSyncDecision,
          persistQueue: setAndPersistPendingBreakQueue,
          recordDiagnosticError,
        })
        hasSyncedAtLeastOne = synced
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
        const next = buildGeofenceErrorState({
          mode: args?.mode ?? "check_in",
          message: "No autenticado",
          updatedAt: now,
          siteId: args?.siteId ?? null,
        })
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
      const target = await resolveGeofenceTarget({
        argsMode: args?.mode,
        argsSiteId: args?.siteId,
        selectedSiteId,
        employeeSites,
        lastLog,
        now,
        updateSource,
        location,
        checkInMaxAccuracyMeters:
          attendancePolicy.geofence_check_in_max_accuracy_meters,
        checkOutMaxAccuracyMeters:
          attendancePolicy.geofence_check_out_max_accuracy_meters,
        resolveBestEffortSelectionLocation,
        buildSelectionCandidates,
        buildDeviceInfoPayload,
      })

      if (target.kind === "blocked") {
        const next = target.state
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      mode = target.mode
      siteId = target.siteId
      location = target.location
      const policy = target.policy

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
        const next = buildGeofenceErrorState({
          mode,
          siteId,
          message: "No se pudo cargar la sede para verificar ubicación",
          updatedAt: now,
        })
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const site = resolved.site
      const preflightState = buildResolvedSitePreflightState({
        mode,
        site,
        hasCoordinates: resolved.hasCoordinates,
        updatedAt: now,
      })
      if (preflightState) {
        geofenceCacheRef.current = preflightState
        setGeofenceState(preflightState)
        return preflightState
      }

      const effectiveRadius = Number(site.radiusMeters ?? 0)

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
          const next = buildGeofenceBlockedState({
            mode,
            siteId: site.id,
            siteName: site.name,
            effectiveRadiusMeters: effectiveRadius,
            message: locationResult.error || "Ubicación requerida para continuar",
            updatedAt: now,
            location: locationResult.location ?? null,
            deviceInfo: buildDeviceInfoPayload(locationResult.location ?? null),
          })
          geofenceCacheRef.current = next
          setGeofenceState(next)
          return next
        }
        location = locationResult.location
      }

      if (!location) {
        const next = buildGeofenceErrorState({
          mode,
          siteId: site.id,
          siteName: site.name,
          effectiveRadiusMeters: effectiveRadius,
          message: "Ubicación requerida para continuar",
          updatedAt: now,
        })
        geofenceCacheRef.current = next
        setGeofenceState(next)
        return next
      }

      const next = validateResolvedSiteGeofence({
        mode,
        site,
        hasCoordinates: resolved.hasCoordinates,
        policy,
        updatedAt: now,
        location,
        buildDeviceInfoPayload,
      })

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
        const errorState = buildGeofenceErrorState({
          mode,
          siteId: siteId ?? null,
          message: "Error al verificar ubicación. Intenta de nuevo.",
          updatedAt: Date.now(),
        })
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
      const geo = await ensureActionGeofenceReady({
        mode: "check_in",
        refreshGeofence,
        canReuseRecentReadyGeofence,
        waitForReady: true,
      })
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

      const payload = buildAttendanceInsertPayload({
        employeeId: user.id,
        siteId: geo.siteId,
        action: "check_in",
        source: getAttendanceSource(),
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracyMeters: location?.accuracy ?? null,
        deviceInfo,
        clientEventId,
        shiftId,
      })

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
        const payload = buildAttendanceInsertPayload({
          employeeId: user.id,
          siteId: lastGeo.siteId,
          action: "check_in",
          source: getAttendanceSource(),
          latitude: lastGeo.location?.latitude ?? null,
          longitude: lastGeo.location?.longitude ?? null,
          accuracyMeters: lastGeo.location?.accuracy ?? null,
          deviceInfo: lastGeo.deviceInfo,
          clientEventId,
          shiftId,
          extraDeviceInfo: {
            queuedAt: new Date().toISOString(),
          },
        })
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

      const geo = await ensureActionGeofenceReady({
        mode: "check_out",
        refreshGeofence,
        canReuseRecentReadyGeofence,
        siteId: siteIdToClose,
      })
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
              buildQueuedBreakPayload({
                action: "end",
                siteId: siteIdToClose,
                source: getAttendanceSource(),
                clientEventId,
                queuedAt: nowIso,
                notesExtra: { reason: "Cierre automático por check-out" },
              }),
              breakCloseError
            )
            applyOptimisticBreakUpdate("end", nowIso)

            const queuedCheckoutEventId = buildClientEventId("check_out")
            const queuedPayload = buildAttendanceInsertPayload({
              employeeId: user.id,
              siteId: siteIdToClose,
              action: "check_out",
              source: getAttendanceSource(),
              latitude: geo.location?.latitude ?? null,
              longitude: geo.location?.longitude ?? null,
              accuracyMeters: geo.location?.accuracy ?? null,
              deviceInfo: geo.deviceInfo,
              clientEventId: queuedCheckoutEventId,
              occurredAt: nowIso,
              shiftId: lastLog.shift_id,
              extraDeviceInfo: {
                queuedAt: nowIso,
                dependsOnBreakEnd: clientEventId,
              },
            })
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

      const payload = buildAttendanceInsertPayload({
        employeeId: user.id,
        siteId: siteIdToClose,
        action: "check_out",
        source: getAttendanceSource(),
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracyMeters: location?.accuracy ?? null,
        deviceInfo,
        clientEventId,
        shiftId: lastLog.shift_id,
      })

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
        const payload = buildAttendanceInsertPayload({
          employeeId: user.id,
          siteId: lastLog.site_id,
          action: "check_out",
          source: getAttendanceSource(),
          latitude: lastGeo.location?.latitude ?? null,
          longitude: lastGeo.location?.longitude ?? null,
          accuracyMeters: lastGeo.location?.accuracy ?? null,
          deviceInfo: lastGeo.deviceInfo,
          clientEventId,
          shiftId: lastLog.shift_id,
          extraDeviceInfo: {
            queuedAt: new Date().toISOString(),
          },
        })
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
      await startAttendanceBreakOnServer({
        siteId: lastLog.site_id,
        source: getAttendanceSource(),
        clientEventId,
      })

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
          buildQueuedBreakPayload({
            action: "start",
            siteId: lastLog.site_id,
            source: getAttendanceSource(),
            clientEventId,
            queuedAt: nowIso,
          }),
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
      await endAttendanceBreakOnServer({
        source: getAttendanceSource(),
        clientEventId,
      })

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
          buildQueuedBreakPayload({
            action: "end",
            siteId: null,
            source: getAttendanceSource(),
            clientEventId,
            queuedAt: nowIso,
          }),
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

  const { registerOpenShiftDepartureEvent } = useShiftDepartureTracking({
    userId: user?.id,
    isEmployeeActive: !!employee,
    attendanceStatus: attendanceState.status,
    isOnBreak: attendanceState.isOnBreak,
    departureMinCheckIntervalMs: attendancePolicy.shift_departure_min_check_interval_ms,
    departureMaxAccuracyMeters: attendancePolicy.shift_departure_max_accuracy_meters,
    departureThresholdMeters: attendancePolicy.shift_departure_threshold_meters,
    getLastAttendanceLog,
    resolveSite,
    loadTodayAttendance,
    getAttendanceSource,
  })

  const { startRealtimeGeofence, stopRealtimeGeofence } = useRealtimeGeofence({
    attendanceStatus: attendanceState.status,
    refreshGeofence,
    registerOpenShiftDepartureEvent,
  })

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
