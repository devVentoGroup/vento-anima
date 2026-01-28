import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0"
import ExcelJS from "https://esm.sh/exceljs@4.4.0"

type EmployeeRow = {
  id: string
  role: string
  site_id: string | null
}

type AttendanceRow = {
  action: string
  occurred_at: string
  latitude: number | null
  longitude: number | null
  accuracy_meters: number | null
  employees: { full_name: string | null; alias: string | null; role: string | null } | null
  sites: { name: string | null } | null
}

const ALLOWED_GLOBAL_ROLES = new Set(["propietario", "gerente_general"])
const LOGO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAR4AAAEcCAYAAAARAdvdAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAIW2SURBVHhe7Z13nFxXdfjPLa/PzO5KWrlXWbLKqqy06hgkwMRA6NiQQOghEHooqST8fqEFAvwglFCTAAEih06wKWZdZEmWd6WVdlW8thDuVtsyM29eu+X3x9w7Hj1tmVntrmTyvp+PPtqZeffNm/fuPfecc885FyAjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjI+Mpxf8Hew6cepNiXqsAAAAASUVORK5CYII="

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
})
const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
})

function formatDate(value: Date): string {
  return DATE_ONLY_FORMATTER.format(value)
}

function formatDateForFilename(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function formatDateTime(value: string): string {
  return DATE_FORMATTER.format(new Date(value))
}

function formatAction(value: string): string {
  if (value === "check_in") return "Entrada"
  if (value === "check_out") return "Salida"
  return value
}

function formatNumber(value: number | null, decimals: number): string {
  if (value == null || Number.isNaN(value)) return ""
  return value.toFixed(decimals)
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

serve(async (req) => {
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

    const role = employee.role
    let scopeSiteId: string | null = null
    let scopeLabel = "Todas las sedes"

    if (!ALLOWED_GLOBAL_ROLES.has(role)) {
      if (role !== "gerente") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: corsHeaders,
        })
      }

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

      if (site.site_type !== "satellite" && site.site_type !== "production_center") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: corsHeaders,
        })
      }

      scopeLabel = site.name ?? "Tu sede"
    }

    const url = new URL(req.url)
    const startParam = url.searchParams.get("start")
    const endParam = url.searchParams.get("end")

    const end = endParam ? new Date(endParam) : new Date()
    const start = startParam ? new Date(startParam) : new Date(end.getTime() - 30 * 86400000)

    const startIso = start.toISOString()
    const endIso = end.toISOString()

    let query = supabase
      .from("attendance_logs")
      .select(
        "action, occurred_at, latitude, longitude, accuracy_meters, employees(full_name, alias, role), sites(name)"
      )
      .gte("occurred_at", startIso)
      .lte("occurred_at", endIso)
      .order("occurred_at", { ascending: true })

    if (scopeSiteId) {
      query = query.eq("site_id", scopeSiteId)
    }

    const { data: rows, error: rowsError } = await query
    if (rowsError) {
      return new Response(JSON.stringify({ error: "Query failed" }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const attendanceRows = (rows ?? []) as AttendanceRow[]

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Asistencia")
    sheet.properties.defaultRowHeight = 18

    const logoBytes = fromBase64(LOGO_BASE64)
    const logoId = workbook.addImage({ buffer: logoBytes, extension: "png" })
    sheet.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 220, height: 80 },
    })

    sheet.mergeCells("A1", "J1")
    sheet.getCell("A1").value = "VENTO GROUP SAS - NIT 901800349-6"
    sheet.getCell("A1").font = { size: 12, bold: true }
    sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" }
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9E8F6" } }
    sheet.getRow(1).height = 22

    sheet.mergeCells("A2", "J2")
    sheet.getCell("A2").value = "REPORTE DE ASISTENCIA"
    sheet.getCell("A2").font = { size: 11, bold: true }
    sheet.getCell("A2").alignment = { vertical: "middle", horizontal: "center" }
    sheet.getRow(2).height = 20

    sheet.mergeCells("A3", "J3")
    sheet.getCell("A3").value = `Periodo: ${formatDate(start)} a ${formatDate(end)}`
    sheet.getCell("A3").font = { size: 10 }
    sheet.getCell("A3").alignment = { vertical: "middle", horizontal: "center" }
    sheet.getRow(3).height = 18

    sheet.mergeCells("A4", "J4")
    sheet.getCell("A4").value = `Alcance: ${scopeLabel}  |  Generado: ${formatDate(
      new Date()
    )}  |  Total registros: ${attendanceRows.length}`
    sheet.getCell("A4").font = { size: 9, italic: true }
    sheet.getCell("A4").alignment = { vertical: "middle", horizontal: "left" }
    sheet.getRow(4).height = 16

    const headerRowIndex = 6
    sheet.getRow(headerRowIndex).values = [
      "No.",
      "Fecha y hora",
      "Empleado",
      "Alias",
      "Rol",
      "Accion",
      "Sede",
      "Lat",
      "Lon",
      "Precision (m)",
    ]

    const headerRow = sheet.getRow(headerRowIndex)
    headerRow.height = 20
    headerRow.eachCell((cell) => {
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
    sheet.views = [{ state: "frozen", ySplit: headerRowIndex }]

    let rowIndex = headerRowIndex + 1
    for (const [index, row] of attendanceRows.entries()) {
      const employee = row.employees
      const site = row.sites
      const rowValues = [
        index + 1,
        formatDateTime(row.occurred_at),
        employee?.full_name ?? "",
        employee?.alias ?? "",
        employee?.role ?? "",
        formatAction(row.action),
        site?.name ?? "",
        formatNumber(row.latitude, 6),
        formatNumber(row.longitude, 6),
        formatNumber(row.accuracy_meters, 1),
      ]
      sheet.getRow(rowIndex).values = rowValues
      sheet.getRow(rowIndex).eachCell((cell) => {
        cell.font = { size: 9 }
        cell.alignment = { vertical: "middle", horizontal: "left" }
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        }
      })
      if (index % 2 === 1) {
        sheet.getRow(rowIndex).eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F7F5F8" } }
        })
      }
      rowIndex += 1
    }

    const summaryRowIndex = rowIndex + 1
    sheet.mergeCells(`A${summaryRowIndex}`, `J${summaryRowIndex}`)
    const summaryCell = sheet.getCell(`A${summaryRowIndex}`)
    summaryCell.value = `Total registros: ${attendanceRows.length}`
    summaryCell.font = { size: 9, bold: true }
    summaryCell.alignment = { vertical: "middle", horizontal: "right" }
    summaryCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E6E1EA" } }
    sheet.getRow(summaryRowIndex).height = 18

    sheet.columns = [
      { width: 6 },
      { width: 22 },
      { width: 30 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 22 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
    ]
    sheet.getColumn(1).alignment = { horizontal: "center" }
    sheet.getColumn(8).alignment = { horizontal: "right" }
    sheet.getColumn(9).alignment = { horizontal: "right" }
    sheet.getColumn(10).alignment = { horizontal: "right" }

    const buffer = await workbook.xlsx.writeBuffer()
    const base64 = toBase64(buffer)
    const filename = `reporte_asistencia_${formatDateForFilename(new Date())}.xlsx`

    return new Response(
      JSON.stringify({
        filename,
        base64,
        scopeLabel,
        start: startIso,
        end: endIso,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: "Unexpected error", message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})

