import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0"
import ExcelJS from "https://esm.sh/exceljs@4.4.0"

type EmployeeRow = {
  id: string
  role: string
  site_id: string | null
}

type EmployeeRelation = {
  full_name: string | null
  alias: string | null
  role: string | null
}

type SiteRelation = {
  name: string | null
}

type AttendanceRow = {
  employee_id: string
  site_id: string
  action: "check_in" | "check_out"
  source: string | null
  notes: string | null
  occurred_at: string
  employees: EmployeeRelation | EmployeeRelation[] | null
  sites: SiteRelation | SiteRelation[] | null
}

type BreakRow = {
  employee_id: string
  site_id: string
  started_at: string
  ended_at: string | null
}

type ShiftEventRow = {
  employee_id: string
  site_id: string
  shift_start_at: string
  event_type: string
  occurred_at: string
  distance_meters: number | null
  notes: string | null
}

type ShiftRecord = {
  employeeId: string
  employeeName: string
  alias: string
  role: string
  siteName: string
  shiftStartAt: string
  shiftEndAt: string
  status: "Cerrado" | "Abierto"
  shiftEndSource: string | null
  shiftEndNotes: string | null
  grossMinutes: number
  breakMinutes: number
  netMinutes: number
  breakRangesLabel: string
  departureAt: string | null
  departureDistanceMeters: number | null
  isAutoClose: boolean
  autoCloseAt: string | null
  observations: string
}

type EmployeeSummary = {
  employeeId: string
  employeeName: string
  alias: string
  role: string
  sites: string[]
  shifts: number
  workDays: number
  grossMinutes: number
  breakMinutes: number
  netMinutes: number
  departureCount: number
  autoCloseCount: number
  openShiftCount: number
}

const ALLOWED_GLOBAL_ROLES = new Set(["propietario", "gerente_general"])
const MANAGER_ROLE = "gerente"
const MANAGER_ALLOWED_SITE_TYPES = new Set(["satellite", "production_center"])
const SHIFT_LEAVE_EVENT_TYPE = "left_site_open_shift"

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
})
const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
})
const TIME_ONLY_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

function formatDate(value: Date): string {
  return DATE_ONLY_FORMATTER.format(value)
}

function formatDateForFilename(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function formatDateTime(value: string): string {
  return DATE_TIME_FORMATTER.format(new Date(value))
}

function formatTime(value: string): string {
  return TIME_ONLY_FORMATTER.format(new Date(value))
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function safeMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function minutesToClock(value: number): string {
  const total = safeMinutes(value)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${hours}:${minutes.toString().padStart(2, "0")}`
}

function buildShiftKey(employeeId: string, shiftStartAtIso: string): string {
  return `${employeeId}|${new Date(shiftStartAtIso).getTime()}`
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.height = 20
  row.eachCell((cell: any) => {
    cell.font = { bold: true, size: 9 }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9E8F6" } }
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    }
  })
}

function applyDataStyle(row: ExcelJS.Row, zebra: boolean) {
  row.eachCell((cell: any) => {
    cell.font = { size: 9 }
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true }
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    }
    if (zebra) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F7F5F8" } }
    }
  })
}

function sanitizeSheetName(base: string, used: Set<string>): string {
  const clean = base.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim() || "Empleado"
  let candidate = clean.slice(0, 31)
  let index = 2
  while (used.has(candidate)) {
    const suffix = ` (${index})`
    candidate = `${clean.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
    index += 1
  }
  used.add(candidate)
  return candidate
}

function buildShiftRecords(
  attendanceRows: AttendanceRow[],
  breakRows: BreakRow[],
  eventRows: ShiftEventRow[],
  rangeEndIso: string,
): ShiftRecord[] {
  const nowMs = Date.now()
  const rangeEndMs = Math.min(new Date(rangeEndIso).getTime(), nowMs)

  const breaksByEmployee = new Map<string, Array<{ startMs: number; endMs: number }>>()
  for (const row of breakRows) {
    const startMs = new Date(row.started_at).getTime()
    const endMsRaw = row.ended_at ? new Date(row.ended_at).getTime() : rangeEndMs
    const endMs = Math.min(endMsRaw, rangeEndMs)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    const list = breaksByEmployee.get(row.employee_id) ?? []
    list.push({ startMs, endMs })
    breaksByEmployee.set(row.employee_id, list)
  }

  const departureByShift = new Map<string, ShiftEventRow>()
  for (const row of eventRows) {
    if (row.event_type !== SHIFT_LEAVE_EVENT_TYPE) continue
    const key = buildShiftKey(row.employee_id, row.shift_start_at)
    const prev = departureByShift.get(key)
    if (!prev || new Date(row.occurred_at).getTime() < new Date(prev.occurred_at).getTime()) {
      departureByShift.set(key, row)
    }
  }

  const logsByEmployee = new Map<string, AttendanceRow[]>()
  for (const row of attendanceRows) {
    const list = logsByEmployee.get(row.employee_id) ?? []
    list.push(row)
    logsByEmployee.set(row.employee_id, list)
  }

  const records: ShiftRecord[] = []

  for (const [employeeId, rows] of logsByEmployee.entries()) {
    const ordered = [...rows].sort((a, b) =>
      a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0,
    )
    const employeeBreaks = breaksByEmployee.get(employeeId) ?? []

    let pendingCheckIn: AttendanceRow | null = null

    const closeShift = (
      checkInRow: AttendanceRow,
      shiftEndAtIso: string,
      status: "Cerrado" | "Abierto",
      shiftEndSource: string | null,
      shiftEndNotes: string | null,
      extraObservation: string | null,
    ) => {
      const startMs = new Date(checkInRow.occurred_at).getTime()
      const endMs = new Date(shiftEndAtIso).getTime()
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return

      const overlapRanges: Array<{ startMs: number; endMs: number }> = []
      let breakMinutesRaw = 0
      for (const item of employeeBreaks) {
        const overlapStart = Math.max(startMs, item.startMs)
        const overlapEnd = Math.min(endMs, item.endMs)
        if (overlapEnd > overlapStart) {
          overlapRanges.push({ startMs: overlapStart, endMs: overlapEnd })
          breakMinutesRaw += (overlapEnd - overlapStart) / 60000
        }
      }

      const grossMinutesRaw = (endMs - startMs) / 60000
      const grossMinutes = safeMinutes(grossMinutesRaw)
      const breakMinutes = safeMinutes(breakMinutesRaw)
      const netMinutes = safeMinutes(grossMinutesRaw - breakMinutesRaw)

      const employeeInfo = unwrapRelation(checkInRow.employees)
      const siteInfo = unwrapRelation(checkInRow.sites)

      const breakRangesLabel =
        overlapRanges.length === 0
          ? "-"
          : overlapRanges
              .map(
                (item) =>
                  `${formatTime(new Date(item.startMs).toISOString())}-${formatTime(new Date(item.endMs).toISOString())}`,
              )
              .join(" | ")

      const departure = departureByShift.get(buildShiftKey(employeeId, checkInRow.occurred_at)) ?? null
      const departureAt = departure?.occurred_at ?? null
      const departureDistanceMeters = departure?.distance_meters ?? null
      const notes = (shiftEndNotes ?? "").toLowerCase()
      const source = (shiftEndSource ?? "").toLowerCase()
      const isAutoClose =
        status === "Cerrado" &&
        (
          source === "system" ||
          notes.includes("cierre automatic") ||
          notes.includes("cierre automático") ||
          notes.includes("auto_close")
        )
      const autoCloseAt = isAutoClose ? shiftEndAtIso : null

      const observations: string[] = []
      if (departureAt) {
        const distanceLabel =
          departureDistanceMeters != null ? ` (${Math.round(departureDistanceMeters)}m)` : ""
        observations.push(`Salida de sede detectada ${formatDateTime(departureAt)}${distanceLabel}`)
      }
      if (isAutoClose) {
        observations.push(`Cierre automático ${formatTime(shiftEndAtIso)}`)
      }
      if (status === "Abierto") {
        observations.push("Turno abierto")
      }
      if (extraObservation) {
        observations.push(extraObservation)
      }

      records.push({
        employeeId,
        employeeName: employeeInfo?.full_name ?? employeeId,
        alias: employeeInfo?.alias ?? "",
        role: employeeInfo?.role ?? "",
        siteName: siteInfo?.name ?? "",
        shiftStartAt: checkInRow.occurred_at,
        shiftEndAt: shiftEndAtIso,
        status,
        shiftEndSource,
        shiftEndNotes,
        grossMinutes,
        breakMinutes,
        netMinutes,
        breakRangesLabel,
        departureAt,
        departureDistanceMeters,
        isAutoClose,
        autoCloseAt,
        observations: observations.length > 0 ? observations.join(" | ") : "Sin novedades",
      })
    }

    for (const row of ordered) {
      if (row.action === "check_in") {
        if (pendingCheckIn) {
          closeShift(
            pendingCheckIn,
            row.occurred_at,
            "Cerrado",
            null,
            null,
            "Nueva entrada sin salida previa",
          )
        }
        pendingCheckIn = row
        continue
      }

      if (row.action === "check_out" && pendingCheckIn) {
        closeShift(
          pendingCheckIn,
          row.occurred_at,
          "Cerrado",
          row.source ?? null,
          row.notes ?? null,
          null,
        )
        pendingCheckIn = null
      }
    }

    if (pendingCheckIn) {
      closeShift(
        pendingCheckIn,
        new Date(rangeEndMs).toISOString(),
        "Abierto",
        null,
        null,
        null,
      )
    }
  }

  return records.sort((a, b) => {
    if (a.employeeName !== b.employeeName) {
      return a.employeeName.localeCompare(b.employeeName, "es")
    }
    return a.shiftStartAt < b.shiftStartAt ? -1 : a.shiftStartAt > b.shiftStartAt ? 1 : 0
  })
}

function buildEmployeeSummary(shifts: ShiftRecord[]): EmployeeSummary[] {
  const byEmployee = new Map<string, EmployeeSummary & { _siteSet: Set<string>; _daySet: Set<string> }>()

  for (const row of shifts) {
    const current =
      byEmployee.get(row.employeeId) ??
      {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        alias: row.alias,
        role: row.role,
        sites: [],
        shifts: 0,
        workDays: 0,
        grossMinutes: 0,
        breakMinutes: 0,
        netMinutes: 0,
        departureCount: 0,
        autoCloseCount: 0,
        openShiftCount: 0,
        _siteSet: new Set<string>(),
        _daySet: new Set<string>(),
      }

    current.shifts += 1
    current.grossMinutes += row.grossMinutes
    current.breakMinutes += row.breakMinutes
    current.netMinutes += row.netMinutes
    if (row.departureAt) current.departureCount += 1
    if (row.isAutoClose) current.autoCloseCount += 1
    if (row.status === "Abierto") current.openShiftCount += 1
    if (row.siteName) current._siteSet.add(row.siteName)
    current._daySet.add(new Date(row.shiftStartAt).toISOString().slice(0, 10))

    byEmployee.set(row.employeeId, current)
  }

  return [...byEmployee.values()]
    .map((item) => ({
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      alias: item.alias,
      role: item.role,
      sites: [...item._siteSet.values()],
      shifts: item.shifts,
      workDays: item._daySet.size,
      grossMinutes: safeMinutes(item.grossMinutes),
      breakMinutes: safeMinutes(item.breakMinutes),
      netMinutes: safeMinutes(item.netMinutes),
      departureCount: item.departureCount,
      autoCloseCount: item.autoCloseCount,
      openShiftCount: item.openShiftCount,
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "es"))
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    const token = authHeader.replace("Bearer ", "")
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const userId = userData.user.id
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, role, site_id")
      .eq("id", userId)
      .single<EmployeeRow>()

    if (employeeError || !employee) {
      return new Response(JSON.stringify({ error: "Employee not found" }), {
        status: 404,
        headers: corsHeaders,
      })
    }

    const url = new URL(req.url)
    const startParam = url.searchParams.get("start")
    const endParam = url.searchParams.get("end")
    const requestedEmployeeId = url.searchParams.get("employee_id")?.trim() || null
    const requestedSiteId = url.searchParams.get("site_id")?.trim() || null

    const end = endParam ? new Date(endParam) : new Date()
    const start = startParam ? new Date(startParam) : new Date(end.getTime() - 30 * 86400000)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid date range" }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const role = employee.role
    const isGlobalRole = ALLOWED_GLOBAL_ROLES.has(role)
    const isManager = role === MANAGER_ROLE

    let scopeSiteId: string | null = null
    let scopeEmployeeId: string | null = null
    let scopeLabel = "Todas las sedes"

    if (isGlobalRole) {
      scopeSiteId = requestedSiteId
      scopeEmployeeId = requestedEmployeeId
      if (scopeSiteId) {
        const { data: scopedSite, error: scopedSiteError } = await supabase
          .from("sites")
          .select("id, name")
          .eq("id", scopeSiteId)
          .maybeSingle()

        if (scopedSiteError || !scopedSite) {
          return new Response(JSON.stringify({ error: "Site scope not found" }), {
            status: 404,
            headers: corsHeaders,
          })
        }
        scopeLabel = `Sede: ${scopedSite.name ?? scopedSite.id}`
      }
    } else if (isManager) {
      const { data: settings } = await supabase
        .from("employee_settings")
        .select("selected_site_id")
        .eq("employee_id", userId)
        .maybeSingle()

      scopeSiteId = settings?.selected_site_id ?? employee.site_id
      if (!scopeSiteId) {
        return new Response(JSON.stringify({ error: "No site assigned" }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      const { data: site, error: siteError } = await supabase
        .from("sites")
        .select("name, site_type")
        .eq("id", scopeSiteId)
        .single()

      if (siteError || !site) {
        return new Response(JSON.stringify({ error: "Site not found" }), {
          status: 404,
          headers: corsHeaders,
        })
      }

      if (!MANAGER_ALLOWED_SITE_TYPES.has(site.site_type ?? "")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: corsHeaders,
        })
      }

      scopeLabel = site.name ?? "Tu sede"
    } else {
      scopeEmployeeId = userId
      scopeLabel = "Registro personal"
    }

    if (scopeEmployeeId) {
      const { data: scopedEmployee, error: scopedEmployeeError } = await supabase
        .from("employees")
        .select("id, full_name, alias, site_id")
        .eq("id", scopeEmployeeId)
        .maybeSingle()

      if (scopedEmployeeError || !scopedEmployee) {
        return new Response(JSON.stringify({ error: "Employee scope not found" }), {
          status: 404,
          headers: corsHeaders,
        })
      }

      if (isGlobalRole && scopeSiteId) {
        const primaryMatchesSite = scopedEmployee.site_id === scopeSiteId
        let assignmentMatchesSite = false

        if (!primaryMatchesSite) {
          const { data: employeeSiteMatch, error: employeeSiteMatchError } = await supabase
            .from("employee_sites")
            .select("employee_id")
            .eq("employee_id", scopeEmployeeId)
            .eq("site_id", scopeSiteId)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle()

          if (employeeSiteMatchError) {
            return new Response(JSON.stringify({ error: "Employee site validation failed" }), {
              status: 500,
              headers: corsHeaders,
            })
          }
          assignmentMatchesSite = !!employeeSiteMatch
        }

        if (!primaryMatchesSite && !assignmentMatchesSite) {
          return new Response(
            JSON.stringify({ error: "Employee does not belong to selected site" }),
            {
              status: 400,
              headers: corsHeaders,
            },
          )
        }
      }

      if (isGlobalRole && scopeEmployeeId !== userId) {
        const employeeLabel = scopedEmployee.alias ?? scopedEmployee.full_name ?? scopedEmployee.id
        scopeLabel = scopeSiteId
          ? `${scopeLabel} | Trabajador: ${employeeLabel}`
          : `Trabajador: ${employeeLabel}`
      }
    }

    let attendanceQuery = supabase
      .from("attendance_logs")
      .select(
        "employee_id, site_id, action, source, notes, occurred_at, employees(full_name, alias, role), sites(name)",
      )
      .gte("occurred_at", startIso)
      .lte("occurred_at", endIso)
      .order("occurred_at", { ascending: true })

    let breaksQuery = supabase
      .from("attendance_breaks")
      .select("employee_id, site_id, started_at, ended_at")
      .lte("started_at", endIso)
      .or(`ended_at.is.null,ended_at.gte.${startIso}`)
      .order("started_at", { ascending: true })

    let eventsQuery = supabase
      .from("attendance_shift_events")
      .select("employee_id, site_id, shift_start_at, event_type, occurred_at, distance_meters, notes")
      .gte("occurred_at", startIso)
      .lte("occurred_at", endIso)
      .order("occurred_at", { ascending: true })

    if (scopeSiteId) {
      attendanceQuery = attendanceQuery.eq("site_id", scopeSiteId)
      breaksQuery = breaksQuery.eq("site_id", scopeSiteId)
      eventsQuery = eventsQuery.eq("site_id", scopeSiteId)
    }
    if (scopeEmployeeId) {
      attendanceQuery = attendanceQuery.eq("employee_id", scopeEmployeeId)
      breaksQuery = breaksQuery.eq("employee_id", scopeEmployeeId)
      eventsQuery = eventsQuery.eq("employee_id", scopeEmployeeId)
    }

    const [
      { data: attendanceData, error: attendanceError },
      { data: breakData, error: breakError },
      { data: eventData, error: eventError },
    ] = await Promise.all([attendanceQuery, breaksQuery, eventsQuery])

    if (attendanceError) {
      return new Response(JSON.stringify({ error: "Attendance query failed" }), {
        status: 500,
        headers: corsHeaders,
      })
    }
    if (breakError) {
      return new Response(JSON.stringify({ error: "Break query failed" }), {
        status: 500,
        headers: corsHeaders,
      })
    }
    if (eventError) {
      return new Response(JSON.stringify({ error: "Shift events query failed" }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const attendanceRows = (attendanceData ?? []) as AttendanceRow[]
    const breakRows = (breakData ?? []) as BreakRow[]
    const eventRows = (eventData ?? []) as ShiftEventRow[]

    const shifts = buildShiftRecords(attendanceRows, breakRows, eventRows, endIso)
    const summaryRows = buildEmployeeSummary(shifts)
    const shiftsByEmployee = new Map<string, ShiftRecord[]>()
    for (const row of shifts) {
      const list = shiftsByEmployee.get(row.employeeId) ?? []
      list.push(row)
      shiftsByEmployee.set(row.employeeId, list)
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "ANIMA"
    workbook.lastModifiedBy = "ANIMA"
    workbook.created = new Date()
    workbook.modified = new Date()

    const summarySheet = workbook.addWorksheet("Resumen gerencial")
    summarySheet.properties.defaultRowHeight = 18

    summarySheet.mergeCells("A1:N1")
    summarySheet.getCell("A1").value = "PLANILLA GERENCIAL DE ASISTENCIA"
    summarySheet.getCell("A1").font = { size: 12, bold: true }
    summarySheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" }
    summarySheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9E8F6" } }

    summarySheet.mergeCells("A2:N2")
    summarySheet.getCell("A2").value = `Periodo: ${formatDate(start)} a ${formatDate(end)} | Alcance: ${scopeLabel} | Generado: ${formatDate(new Date())}`
    summarySheet.getCell("A2").font = { size: 9, italic: true }
    summarySheet.getCell("A2").alignment = { vertical: "middle", horizontal: "left" }

    const summaryHeaderRow = 4
    summarySheet.getRow(summaryHeaderRow).values = [
      "No.",
      "Empleado",
      "Alias",
      "Rol",
      "Sede(s)",
      "Turnos",
      "Días trabajados",
      "Minutos brutos",
      "Minutos descanso",
      "Minutos netos",
      "Horas netas",
      "Salidas de sede",
      "Cierres automáticos",
      "Turnos abiertos",
    ]
    applyHeaderStyle(summarySheet.getRow(summaryHeaderRow))
    summarySheet.views = [{ state: "frozen", ySplit: summaryHeaderRow }]

    let summaryDataRow = summaryHeaderRow + 1
    let totalGross = 0
    let totalBreak = 0
    let totalNet = 0
    let totalShifts = 0
    let totalDepartures = 0
    let totalAutoClose = 0
    let totalOpen = 0

    for (const [index, row] of summaryRows.entries()) {
      totalGross += row.grossMinutes
      totalBreak += row.breakMinutes
      totalNet += row.netMinutes
      totalShifts += row.shifts
      totalDepartures += row.departureCount
      totalAutoClose += row.autoCloseCount
      totalOpen += row.openShiftCount

      summarySheet.getRow(summaryDataRow).values = [
        index + 1,
        row.employeeName,
        row.alias,
        row.role,
        row.sites.join(" | "),
        row.shifts,
        row.workDays,
        row.grossMinutes,
        row.breakMinutes,
        row.netMinutes,
        minutesToClock(row.netMinutes),
        row.departureCount,
        row.autoCloseCount,
        row.openShiftCount,
      ]
      applyDataStyle(summarySheet.getRow(summaryDataRow), index % 2 === 1)
      summaryDataRow += 1
    }

    if (summaryRows.length === 0) {
      summarySheet.mergeCells(`A${summaryDataRow}:N${summaryDataRow}`)
      summarySheet.getCell(`A${summaryDataRow}`).value = "Sin registros para el rango seleccionado."
      summarySheet.getCell(`A${summaryDataRow}`).font = { size: 9, italic: true }
      summarySheet.getCell(`A${summaryDataRow}`).alignment = { vertical: "middle", horizontal: "center" }
      summaryDataRow += 1
    }

    const summaryTotalsRow = summaryDataRow + 1
    summarySheet.getRow(summaryTotalsRow).values = [
      "",
      "TOTALES",
      "",
      "",
      "",
      totalShifts,
      "",
      totalGross,
      totalBreak,
      totalNet,
      minutesToClock(totalNet),
      totalDepartures,
      totalAutoClose,
      totalOpen,
    ]
    summarySheet.getRow(summaryTotalsRow).eachCell((cell: any) => {
      cell.font = { size: 9, bold: true }
      cell.alignment = { vertical: "middle", horizontal: "center" }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E6E1EA" } }
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      }
    })

    summarySheet.columns = [
      { width: 6 },
      { width: 28 },
      { width: 14 },
      { width: 14 },
      { width: 28 },
      { width: 10 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 14 },
      { width: 16 },
      { width: 14 },
    ]

    const generalSheet = workbook.addWorksheet("Registro general")
    generalSheet.properties.defaultRowHeight = 18
    generalSheet.columns = [
      { width: 6 },
      { width: 16 },
      { width: 22 },
      { width: 18 },
      { width: 12 },
      { width: 26 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 22 },
      { width: 22 },
      { width: 34 },
    ]

    generalSheet.mergeCells("A1:M1")
    generalSheet.getCell("A1").value = "REGISTRO GENERAL DE ASISTENCIA (SECCIONADO POR PERSONA)"
    generalSheet.getCell("A1").font = { size: 11, bold: true }
    generalSheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" }
    generalSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9E8F6" } }

    generalSheet.mergeCells("A2:M2")
    generalSheet.getCell("A2").value = `Periodo: ${formatDate(start)} a ${formatDate(end)} | Alcance: ${scopeLabel}`
    generalSheet.getCell("A2").font = { size: 9, italic: true }
    generalSheet.getCell("A2").alignment = { vertical: "middle", horizontal: "left" }

    let generalRow = 4
    if (summaryRows.length === 0) {
      generalSheet.mergeCells(`A${generalRow}:M${generalRow}`)
      generalSheet.getCell(`A${generalRow}`).value = "Sin turnos para el rango seleccionado."
      generalSheet.getCell(`A${generalRow}`).font = { size: 9, italic: true }
      generalSheet.getCell(`A${generalRow}`).alignment = { vertical: "middle", horizontal: "center" }
    } else {
      for (const person of summaryRows) {
        const personShifts = shiftsByEmployee.get(person.employeeId) ?? []
        generalSheet.mergeCells(`A${generalRow}:M${generalRow}`)
        const titleCell = generalSheet.getCell(`A${generalRow}`)
        titleCell.value = `Empleado: ${person.employeeName} | Alias: ${person.alias || "-"} | Rol: ${person.role || "-"}`
        titleCell.font = { size: 9, bold: true }
        titleCell.alignment = { vertical: "middle", horizontal: "left" }
        titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1ECF5" } }
        generalRow += 1

        generalSheet.getRow(generalRow).values = [
          "No.",
          "Fecha",
          "Sede",
          "Entrada",
          "Descansos",
          "Min descanso",
          "Salida",
          "Min brutos",
          "Min netos",
          "Horas netas",
          "Salida de sede",
          "Cierre automático",
          "Observaciones",
        ]
        applyHeaderStyle(generalSheet.getRow(generalRow))
        generalRow += 1

        let subtotalBreak = 0
        let subtotalNet = 0
        let subtotalGross = 0

        for (const [idx, shift] of personShifts.entries()) {
          subtotalBreak += shift.breakMinutes
          subtotalNet += shift.netMinutes
          subtotalGross += shift.grossMinutes

          generalSheet.getRow(generalRow).values = [
            idx + 1,
            formatDate(new Date(shift.shiftStartAt)),
            shift.siteName || "-",
            formatTime(shift.shiftStartAt),
            shift.breakRangesLabel,
            shift.breakMinutes,
            shift.status === "Abierto" ? "-" : formatTime(shift.shiftEndAt),
            shift.grossMinutes,
            shift.netMinutes,
            minutesToClock(shift.netMinutes),
            shift.departureAt ? formatDateTime(shift.departureAt) : "-",
            shift.autoCloseAt ? formatDateTime(shift.autoCloseAt) : "-",
            shift.observations,
          ]
          applyDataStyle(generalSheet.getRow(generalRow), idx % 2 === 1)
          generalRow += 1
        }

        generalSheet.getRow(generalRow).values = [
          "",
          "Subtotal",
          "",
          "",
          "",
          subtotalBreak,
          "",
          subtotalGross,
          subtotalNet,
          minutesToClock(subtotalNet),
          "",
          "",
          "",
        ]
        generalSheet.getRow(generalRow).eachCell((cell: any) => {
          cell.font = { size: 9, bold: true }
          cell.alignment = { vertical: "middle", horizontal: "center" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E6E1EA" } }
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          }
        })
        generalRow += 2
      }
    }

    const usedSheetNames = new Set<string>(["Resumen gerencial", "Registro general"])

    for (const person of summaryRows) {
      const personShifts = shiftsByEmployee.get(person.employeeId) ?? []
      const sheetName = sanitizeSheetName(`EMP ${person.alias || person.employeeName}`, usedSheetNames)
      const sheet = workbook.addWorksheet(sheetName)
      sheet.properties.defaultRowHeight = 18
      sheet.columns = [
        { width: 6 },
        { width: 16 },
        { width: 20 },
        { width: 12 },
        { width: 26 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 22 },
        { width: 22 },
        { width: 34 },
      ]

      sheet.mergeCells("A1:M1")
      sheet.getCell("A1").value = `PLANILLA INDIVIDUAL - ${person.employeeName}`
      sheet.getCell("A1").font = { size: 11, bold: true }
      sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" }
      sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9E8F6" } }

      sheet.mergeCells("A2:M2")
      sheet.getCell("A2").value = `Periodo: ${formatDate(start)} a ${formatDate(end)} | Rol: ${person.role || "-"} | Sede(s): ${person.sites.join(" | ") || "-"}`
      sheet.getCell("A2").font = { size: 9, italic: true }
      sheet.getCell("A2").alignment = { vertical: "middle", horizontal: "left" }

      const headerRow = 4
      sheet.getRow(headerRow).values = [
        "No.",
        "Fecha",
        "Sede",
        "Entrada",
        "Descansos",
        "Min descanso",
        "Salida",
        "Min brutos",
        "Min netos",
        "Horas netas",
        "Salida de sede",
        "Cierre automático",
        "Observaciones",
      ]
      applyHeaderStyle(sheet.getRow(headerRow))
      sheet.views = [{ state: "frozen", ySplit: headerRow }]

      let rowIndex = headerRow + 1
      let subtotalBreak = 0
      let subtotalGross = 0
      let subtotalNet = 0

      for (const [idx, shift] of personShifts.entries()) {
        subtotalBreak += shift.breakMinutes
        subtotalGross += shift.grossMinutes
        subtotalNet += shift.netMinutes

        sheet.getRow(rowIndex).values = [
          idx + 1,
          formatDate(new Date(shift.shiftStartAt)),
          shift.siteName || "-",
          formatTime(shift.shiftStartAt),
          shift.breakRangesLabel,
          shift.breakMinutes,
          shift.status === "Abierto" ? "-" : formatTime(shift.shiftEndAt),
          shift.grossMinutes,
          shift.netMinutes,
          minutesToClock(shift.netMinutes),
          shift.departureAt ? formatDateTime(shift.departureAt) : "-",
          shift.autoCloseAt ? formatDateTime(shift.autoCloseAt) : "-",
          shift.observations,
        ]
        applyDataStyle(sheet.getRow(rowIndex), idx % 2 === 1)
        rowIndex += 1
      }

      if (personShifts.length === 0) {
        sheet.mergeCells(`A${rowIndex}:M${rowIndex}`)
        sheet.getCell(`A${rowIndex}`).value = "Sin turnos para el rango seleccionado."
        sheet.getCell(`A${rowIndex}`).font = { size: 9, italic: true }
        sheet.getCell(`A${rowIndex}`).alignment = { vertical: "middle", horizontal: "center" }
        rowIndex += 1
      }

      const totalsRow = rowIndex + 1
      sheet.getRow(totalsRow).values = [
        "",
        "Totales",
        "",
        "",
        "",
        subtotalBreak,
        "",
        subtotalGross,
        subtotalNet,
        minutesToClock(subtotalNet),
        "",
        "",
        "",
      ]
      sheet.getRow(totalsRow).eachCell((cell: any) => {
        cell.font = { size: 9, bold: true }
        cell.alignment = { vertical: "middle", horizontal: "center" }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E6E1EA" } }
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        }
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const base64 = toBase64(buffer)
    const filename = `reporte_asistencia_gerencial_${formatDateForFilename(new Date())}.xlsx`

    return new Response(
      JSON.stringify({
        filename,
        base64,
        scopeLabel,
        start: startIso,
        end: endIso,
        totalShifts: shifts.length,
        totalEmployees: summaryRows.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: "Unexpected error", message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
