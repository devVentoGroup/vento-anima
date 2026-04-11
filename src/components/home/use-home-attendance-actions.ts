import { useCallback, useEffect, useRef, useState } from "react"

type ActionResult = {
  success: boolean
  error?: string | null
  queued?: boolean
}

type UseHomeAttendanceActionsArgs = {
  userId: string | null | undefined
  isLoading: boolean
  isGeoChecking: boolean
  isCheckedIn: boolean
  requiresSelection: boolean
  isOnBreak: boolean
  loadTodayAttendance: () => Promise<void>
  refreshGeofence: (args: { force: boolean; source: "user" }) => Promise<any>
  checkIn: () => Promise<ActionResult>
  checkOut: () => Promise<ActionResult>
  startBreak: () => Promise<ActionResult>
  endBreak: () => Promise<ActionResult>
  onRequireSiteSelection: () => void
}

export function useHomeAttendanceActions({
  userId,
  isLoading,
  isGeoChecking,
  isCheckedIn,
  requiresSelection,
  isOnBreak,
  loadTodayAttendance,
  refreshGeofence,
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  onRequireSiteSelection,
}: UseHomeAttendanceActionsArgs) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isCheckActionLocked, setIsCheckActionLocked] = useState(false)
  const [recentQueuedFeedback, setRecentQueuedFeedback] = useState(false)
  const checkActionLockRef = useRef(false)

  useEffect(() => {
    if (!recentQueuedFeedback) return
    const timer = setTimeout(() => setRecentQueuedFeedback(false), 8000)
    return () => clearTimeout(timer)
  }, [recentQueuedFeedback])

  const handleRefresh = useCallback(async () => {
    if (!userId) return
    setIsRefreshing(true)
    setActionError(null)
    try {
      await loadTodayAttendance()
      await refreshGeofence({ force: true, source: "user" })
    } finally {
      setIsRefreshing(false)
    }
  }, [loadTodayAttendance, refreshGeofence, userId])

  const handleCheck = useCallback(async () => {
    if (isLoading) return
    if (isGeoChecking) return
    if (checkActionLockRef.current) return

    checkActionLockRef.current = true
    setIsCheckActionLocked(true)
    setActionError(null)

    try {
      if (requiresSelection) {
        setActionError("Selecciona una sede para continuar.")
        onRequireSiteSelection()
        return
      }

      const result = isCheckedIn ? await checkOut() : await checkIn()
      if (!result.success) {
        setActionError(result.error || "No se pudo completar la acción")
      } else if (result.queued) {
        setRecentQueuedFeedback(true)
      }
    } finally {
      checkActionLockRef.current = false
      setIsCheckActionLocked(false)
    }
  }, [
    checkIn,
    checkOut,
    isCheckedIn,
    isGeoChecking,
    isLoading,
    onRequireSiteSelection,
    requiresSelection,
  ])

  const handleToggleBreak = useCallback(async () => {
    if (!isCheckedIn || isLoading) return
    setActionError(null)

    const result = isOnBreak ? await endBreak() : await startBreak()

    if (!result.success) {
      setActionError(result.error || "No se pudo actualizar el descanso")
    } else if (result.queued) {
      setRecentQueuedFeedback(true)
    }
  }, [endBreak, isCheckedIn, isLoading, isOnBreak, startBreak])

  return {
    isRefreshing,
    actionError,
    setActionError,
    isCheckActionLocked,
    recentQueuedFeedback,
    handleRefresh,
    handleCheck,
    handleToggleBreak,
  }
}
