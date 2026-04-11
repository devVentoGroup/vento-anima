import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import * as FileSystem from "expo-file-system/legacy"
import * as Sharing from "expo-sharing"
import * as MailComposer from "expo-mail-composer"

import type {
  ReportEmployeeOption,
  ReportSiteOption,
  ReportSummaryResponse,
} from "@/components/home/report-types"
import { PALETTE } from "@/components/home/theme"
import { supabase } from "@/lib/supabase"

type UseHomeReportsArgs = {
  isGlobalReportRole: boolean
  canViewReports: boolean
  canManagerTeamReports: boolean
  canPersonalReports: boolean
  selectedSiteName: string | null | undefined
  userId: string | null | undefined
  userEmail: string | null | undefined
  sessionAccessToken: string | null | undefined
}

export function useHomeReports({
  isGlobalReportRole,
  canViewReports,
  canManagerTeamReports,
  canPersonalReports,
  selectedSiteName,
  userId,
  userEmail,
  sessionAccessToken,
}: UseHomeReportsArgs) {
  const [isExporting, setIsExporting] = useState(false)
  const [isDateModalOpen, setIsDateModalOpen] = useState(false)
  const [reportStartDate, setReportStartDate] = useState(() => {
    const start = new Date()
    start.setDate(start.getDate() - 30)
    start.setHours(0, 0, 0, 0)
    return start
  })
  const [reportEndDate, setReportEndDate] = useState(() => {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return end
  })
  const [draftStartDate, setDraftStartDate] = useState<Date | null>(null)
  const [draftEndDate, setDraftEndDate] = useState<Date | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const base = new Date()
    base.setDate(1)
    base.setHours(0, 0, 0, 0)
    return base
  })
  const [reportEmployees, setReportEmployees] = useState<ReportEmployeeOption[]>([])
  const [reportSites, setReportSites] = useState<ReportSiteOption[]>([])
  const [reportSiteId, setReportSiteId] = useState<string | null>(null)
  const [reportEmployeeId, setReportEmployeeId] = useState<string | null>(null)
  const [isLoadingReportEmployees, setIsLoadingReportEmployees] = useState(false)
  const [isLoadingReportSites, setIsLoadingReportSites] = useState(false)
  const [isReportSiteModalOpen, setIsReportSiteModalOpen] = useState(false)
  const [isReportEmployeeModalOpen, setIsReportEmployeeModalOpen] = useState(false)
  const [reportSummary, setReportSummary] = useState<ReportSummaryResponse | null>(null)
  const [isLoadingReportSummary, setIsLoadingReportSummary] = useState(false)
  const [reportSummaryError, setReportSummaryError] = useState<string | null>(null)

  useEffect(() => {
    if (!isDateModalOpen) return
    setDraftStartDate(null)
    setDraftEndDate(null)
    const base = new Date(reportEndDate)
    base.setDate(1)
    base.setHours(0, 0, 0, 0)
    setCalendarMonth(base)
  }, [isDateModalOpen, reportEndDate])

  const selectedReportSite = useMemo(
    () => (reportSiteId ? reportSites.find((item) => item.id === reportSiteId) ?? null : null),
    [reportSiteId, reportSites],
  )

  const filteredReportEmployees = useMemo(() => {
    if (!reportSiteId) return reportEmployees
    return reportEmployees.filter((item) => item.siteIds.includes(reportSiteId))
  }, [reportEmployees, reportSiteId])

  const selectedReportEmployee = useMemo(
    () =>
      reportEmployeeId
        ? filteredReportEmployees.find((item) => item.id === reportEmployeeId) ?? null
        : null,
    [reportEmployeeId, filteredReportEmployees],
  )

  const effectiveReportSiteId = isGlobalReportRole ? reportSiteId : null
  const effectiveReportEmployeeId = isGlobalReportRole
    ? reportEmployeeId
    : canPersonalReports
      ? userId ?? null
      : null

  const reportTitle = canPersonalReports ? "Mi asistencia" : "Asistencia del equipo"

  const reportScopeLabel = isGlobalReportRole
    ? selectedReportSite && selectedReportEmployee
      ? `Sede: ${selectedReportSite.label} | Trabajador: ${selectedReportEmployee.label}`
      : selectedReportSite
        ? `Sede: ${selectedReportSite.label}`
        : selectedReportEmployee
          ? `Trabajador: ${selectedReportEmployee.label}`
          : "Todas las sedes"
    : canManagerTeamReports
      ? selectedSiteName || "Tu sede"
      : "Registro personal"

  useEffect(() => {
    if (!isGlobalReportRole) {
      setReportEmployees([])
      setReportSites([])
      setReportSiteId(null)
      setReportEmployeeId(null)
      setIsLoadingReportEmployees(false)
      setIsLoadingReportSites(false)
      return
    }

    let cancelled = false
    setIsLoadingReportEmployees(true)
    setIsLoadingReportSites(true)
    void (async () => {
      try {
        const [
          { data: sitesData, error: sitesError },
          { data: employeesData, error: employeesError },
          { data: assignmentsData, error: assignmentsError },
        ] = await Promise.all([
          supabase
            .from("sites")
            .select("id, name, is_active")
            .eq("is_active", true)
            .order("name", { ascending: true }),
          supabase
            .from("employees")
            .select("id, full_name, alias, role, is_active, site_id")
            .eq("is_active", true)
            .order("full_name", { ascending: true }),
          supabase.from("employee_sites").select("employee_id, site_id, is_active").eq("is_active", true),
        ])

        if (sitesError) throw sitesError
        if (employeesError) throw employeesError
        if (assignmentsError) throw assignmentsError
        if (cancelled) return

        const siteOptions = ((sitesData as any[]) ?? []).map((row) => ({
          id: row.id as string,
          label: (row.name as string | null) ?? "Sede sin nombre",
        }))
        setReportSites(siteOptions)
        setReportSiteId((prev) => (prev && !siteOptions.some((item) => item.id === prev) ? null : prev))

        const siteIdsByEmployee = new Map<string, Set<string>>()
        for (const row of (assignmentsData as any[]) ?? []) {
          const employeeId = row.employee_id as string | null
          const siteId = row.site_id as string | null
          if (!employeeId || !siteId) continue
          const set = siteIdsByEmployee.get(employeeId) ?? new Set<string>()
          set.add(siteId)
          siteIdsByEmployee.set(employeeId, set)
        }

        const options = ((employeesData as any[]) ?? []).map((row) => {
          const employeeId = row.id as string
          const fallbackSiteId = (row.site_id as string | null) ?? null
          const siteSet = siteIdsByEmployee.get(employeeId) ?? new Set<string>()
          if (fallbackSiteId) siteSet.add(fallbackSiteId)
          return {
            id: employeeId,
            label: (row.alias as string | null) ?? (row.full_name as string | null) ?? employeeId,
            role: (row.role as string | null) ?? null,
            siteIds: [...siteSet.values()],
          } as ReportEmployeeOption
        })
        setReportEmployees(options)
        setReportEmployeeId((prev) => (prev && !options.some((item) => item.id === prev) ? null : prev))
      } catch (err) {
        console.warn("[HOME] Unable to load report filters:", err)
      } finally {
        if (!cancelled) {
          setIsLoadingReportEmployees(false)
          setIsLoadingReportSites(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isGlobalReportRole])

  useEffect(() => {
    if (!isGlobalReportRole) return
    if (!reportEmployeeId) return
    if (filteredReportEmployees.some((item) => item.id === reportEmployeeId)) return
    setReportEmployeeId(null)
  }, [isGlobalReportRole, reportEmployeeId, filteredReportEmployees])

  const formatShortDate = (value: Date) =>
    value.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })

  const reportRangeLabel = `${formatShortDate(reportStartDate)} - ${formatShortDate(reportEndDate)}`

  const formatMonthLabel = (value: Date) => {
    const label = value.toLocaleDateString("es-CO", {
      month: "long",
      year: "numeric",
    })
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
  }

  const toDateKey = (value: Date) => {
    const yyyy = value.getFullYear()
    const mm = String(value.getMonth() + 1).padStart(2, "0")
    const dd = String(value.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  const markedDates = useMemo(() => {
    if (!draftStartDate) return {}
    const startKey = toDateKey(draftStartDate)
    const endDate = draftEndDate ?? draftStartDate
    const endKey = toDateKey(endDate)

    const marked: Record<string, any> = {}
    const cursor = new Date(draftStartDate)
    cursor.setHours(0, 0, 0, 0)
    const endCursor = new Date(endDate)
    endCursor.setHours(0, 0, 0, 0)

    while (cursor <= endCursor) {
      const key = toDateKey(cursor)
      const isStart = key === startKey
      const isEnd = key === endKey
      const isEdge = isStart || isEnd

      marked[key] = {
        customStyles: {
          container: {
            backgroundColor: isEdge ? PALETTE.accent : "rgba(226, 0, 106, 0.12)",
            borderRadius: isEdge ? 18 : 8,
          },
          text: {
            color: isEdge ? "white" : PALETTE.text,
            fontWeight: "600",
          },
        },
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return marked
  }, [draftStartDate, draftEndDate])

  const applyRange = useCallback((start: Date, end: Date) => {
    const nextStart = new Date(start)
    const nextEnd = new Date(end)
    nextStart.setHours(0, 0, 0, 0)
    nextEnd.setHours(23, 59, 59, 999)
    if (nextStart > nextEnd) {
      const tmp = nextStart.getTime()
      nextStart.setTime(nextEnd.getTime())
      nextEnd.setTime(tmp)
    }
    setReportStartDate(nextStart)
    setReportEndDate(nextEnd)
  }, [])

  const buildAttendanceReportUrl = useCallback(
    (format: "xlsx" | "json" = "xlsx") => {
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
      if (!baseUrl) {
        throw new Error("Missing Supabase URL")
      }

      const url = new URL("/functions/v1/attendance-report", baseUrl)
      url.searchParams.set("start", reportStartDate.toISOString())
      url.searchParams.set("end", reportEndDate.toISOString())
      url.searchParams.set("format", format)
      const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (deviceTimeZone) {
        url.searchParams.set("tz", deviceTimeZone)
      }
      if (effectiveReportSiteId) {
        url.searchParams.set("site_id", effectiveReportSiteId)
      }
      if (effectiveReportEmployeeId) {
        url.searchParams.set("employee_id", effectiveReportEmployeeId)
      }

      return url
    },
    [effectiveReportEmployeeId, effectiveReportSiteId, reportEndDate, reportStartDate],
  )

  const createReportFile = useCallback(async () => {
    if (!sessionAccessToken) {
      throw new Error("No hay sesión activa")
    }

    const response = await fetch(buildAttendanceReportUrl("xlsx").toString(), {
      headers: {
        Authorization: `Bearer ${sessionAccessToken}`,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to generate report: ${text}`)
    }

    const payload = await response.json()
    const filename = payload.filename ?? "reporte_asistencia.xlsx"
    const uri = `${FileSystem.cacheDirectory}${filename}`

    await FileSystem.writeAsStringAsync(uri, payload.base64, {
      encoding: FileSystem.EncodingType.Base64,
    })

    return uri
  }, [buildAttendanceReportUrl, sessionAccessToken])

  const loadReportSummary = useCallback(async () => {
    if (!canViewReports || !sessionAccessToken) {
      setReportSummary(null)
      setReportSummaryError(null)
      return
    }

    setIsLoadingReportSummary(true)
    setReportSummaryError(null)
    try {
      const response = await fetch(buildAttendanceReportUrl("json").toString(), {
        headers: {
          Authorization: `Bearer ${sessionAccessToken}`,
        },
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || "Failed to load report summary")
      }

      const payload = (await response.json()) as ReportSummaryResponse
      setReportSummary(payload)
    } catch (error) {
      console.error("[HOME] report summary error:", error)
      setReportSummary(null)
      setReportSummaryError("No se pudo cargar el resumen operativo.")
    } finally {
      setIsLoadingReportSummary(false)
    }
  }, [buildAttendanceReportUrl, canViewReports, sessionAccessToken])

  const handleDownloadReport = useCallback(async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const uri = await createReportFile()
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Exportación",
          "No hay opciones de compartir disponibles en este dispositivo.",
        )
        return
      }
      await Sharing.shareAsync(uri, { dialogTitle: "Exportar asistencia" })
    } catch (err) {
      console.error("Export error:", err)
      Alert.alert("Error", "No se pudo exportar el reporte.")
    } finally {
      setIsExporting(false)
    }
  }, [createReportFile, isExporting])

  const handleEmailReport = useCallback(async () => {
    if (isExporting) return
    if (!userEmail) {
      Alert.alert("Error", "No hay email disponible para tu usuario.")
      return
    }
    setIsExporting(true)
    try {
      const uri = await createReportFile()
      const canEmail = await MailComposer.isAvailableAsync()
      if (!canEmail) {
        await Sharing.shareAsync(uri, { dialogTitle: "Enviar reporte" })
        return
      }
      await MailComposer.composeAsync({
        recipients: [userEmail],
        subject: "Reporte de asistencia ANIMA",
        body: `Adjunto encuentras el reporte de asistencia (${reportScopeLabel}).`,
        attachments: [uri],
      })
    } catch (err) {
      console.error("Email error:", err)
      Alert.alert("Error", "No se pudo preparar el correo.")
    } finally {
      setIsExporting(false)
    }
  }, [createReportFile, isExporting, reportScopeLabel, userEmail])

  const handleSelectRangeDay = useCallback((dateString: string) => {
    const selected = new Date(`${dateString}T00:00:00`)
    if (!draftStartDate || (draftStartDate && draftEndDate)) {
      setDraftStartDate(selected)
      setDraftEndDate(null)
      return
    }
    if (selected < draftStartDate) {
      setDraftEndDate(new Date(draftStartDate))
      setDraftStartDate(selected)
      return
    }
    setDraftEndDate(selected)
  }, [draftEndDate, draftStartDate])

  const applyDraftRange = useCallback(() => {
    if (!draftStartDate) return
    const end = draftEndDate ?? draftStartDate
    applyRange(draftStartDate, end)
    setIsDateModalOpen(false)
  }, [applyRange, draftEndDate, draftStartDate])

  const shiftCalendarMonth = useCallback((delta: number) => {
    setCalendarMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(prev.getMonth() + delta)
      next.setDate(1)
      next.setHours(0, 0, 0, 0)
      return next
    })
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadReportSummary()
    }, [loadReportSummary]),
  )

  return {
    isExporting,
    isDateModalOpen,
    setIsDateModalOpen,
    reportStartDate,
    reportEndDate,
    draftStartDate,
    draftEndDate,
    calendarMonth,
    setCalendarMonth,
    reportEmployees,
    reportSites,
    reportSiteId,
    setReportSiteId,
    reportEmployeeId,
    setReportEmployeeId,
    isLoadingReportEmployees,
    isLoadingReportSites,
    isReportSiteModalOpen,
    setIsReportSiteModalOpen,
    isReportEmployeeModalOpen,
    setIsReportEmployeeModalOpen,
    reportSummary,
    isLoadingReportSummary,
    reportSummaryError,
    filteredReportEmployees,
    selectedReportEmployee,
    selectedReportSite,
    reportTitle,
    reportScopeLabel,
    reportRangeLabel,
    formatShortDate,
    formatMonthLabel,
    toDateKey,
    markedDates,
    handleDownloadReport,
    handleEmailReport,
    handleSelectRangeDay,
    applyDraftRange,
    shiftCalendarMonth,
    loadReportSummary,
  }
}
