/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.91.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
const DEFAULT_TIME_ZONE = "America/Bogota"
const DEFAULT_REMINDER_MINUTES = 5
const DEFAULT_AUTO_CLOSE_GRACE_MINUTES = 30
const LOOKBACK_DAYS = 2
const LOOKAHEAD_DAYS = 1

type ShiftPolicyRow = {
  end_reminder_minutes_before_end: number | null
  end_reminder_minutes_after_end: number | null
  auto_checkout_grace_minutes_after_end: number | null
  end_reminder_enabled: boolean | null
  scheduled_auto_checkout_enabled: boolean | null
}

type InternalJobSecretRow = {
  secret_value: string | null
}

type ShiftRow = {
  id: string
  employee_id: string
  site_id: string
  shift_date: string
  start_time: string
  end_time: string
  shift_kind: "laboral" | "descanso" | null
  employees: { full_name: string | null } | { full_name: string | null }[] | null
  sites: { name: string | null } | { name: string | null }[] | null
}

type RuntimeEventRow = {
  shift_id: string
  event_type: string
}

type AttendanceLogRow = {
  employee_id: string
  site_id: string
  action: "check_in" | "check_out"
  occurred_at: string
  shift_id: string | null
}

type TokenRow = {
  token: string
  employee_id: string
}

type SessionRow = {
  shiftId: string | null
  checkInAt: string
  checkOutAt: string | null
  effectiveEndAt: string
  status: "Cerrado" | "Abierto"
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return { year, month, day }
}

function parseTimeOnly(value: string) {
  const [hour, minute, second] = value.split(":").map((part) => Number(part))
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
    second: Number.isFinite(second) ? second : 0,
  }
}

function getZonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(value)

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  }
}

function zonedLocalToUtc(dateValue: string, timeValue: string, timeZone: string): string {
  const { year, month, day } = parseDateOnly(dateValue)
  const desiredTime = parseTimeOnly(timeValue)

  let guessMs = Date.UTC(
    year,
    Math.max(0, month - 1),
    day,
    desiredTime.hour,
    desiredTime.minute,
    desiredTime.second,
  )

  for (let i = 0; i < 2; i += 1) {
    const zoned = getZonedParts(new Date(guessMs), timeZone)
    const desiredMs = Date.UTC(
      year,
      Math.max(0, month - 1),
      day,
      desiredTime.hour,
      desiredTime.minute,
      desiredTime.second,
    )
    const zonedMs = Date.UTC(
      zoned.year,
      Math.max(0, zoned.month - 1),
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    )
    guessMs += desiredMs - zonedMs
  }

  return new Date(guessMs).toISOString()
}

function formatDateKeyInTimeZone(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value)
}

function addDaysToDateKey(dateKey: string, delta: number): string {
  const base = new Date(`${dateKey}T12:00:00.000Z`)
  base.setUTCDate(base.getUTCDate() + delta)
  return base.toISOString().slice(0, 10)
}

function buildLogSessions(logs: AttendanceLogRow[], nowIso: string): SessionRow[] {
  const ordered = [...logs].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const sessions: SessionRow[] = []
  let pendingCheckIn: AttendanceLogRow | null = null

  for (const row of ordered) {
    if (row.action === "check_in") {
      if (pendingCheckIn) {
        sessions.push({
          shiftId: pendingCheckIn.shift_id ?? null,
          checkInAt: pendingCheckIn.occurred_at,
          checkOutAt: null,
          effectiveEndAt: row.occurred_at,
          status: "Cerrado",
        })
      }
      pendingCheckIn = row
      continue
    }

    if (pendingCheckIn && row.action === "check_out") {
      sessions.push({
        shiftId: row.shift_id ?? pendingCheckIn.shift_id ?? null,
        checkInAt: pendingCheckIn.occurred_at,
        checkOutAt: row.occurred_at,
        effectiveEndAt: row.occurred_at,
        status: "Cerrado",
      })
      pendingCheckIn = null
    }
  }

  if (pendingCheckIn) {
    sessions.push({
      shiftId: pendingCheckIn.shift_id ?? null,
      checkInAt: pendingCheckIn.occurred_at,
      checkOutAt: null,
      effectiveEndAt: nowIso,
      status: "Abierto",
    })
  }

  return sessions
}

function matchSessionToShift(shift: ShiftRow, sessions: SessionRow[], timeZone: string) {
  const scheduledStartMs = new Date(zonedLocalToUtc(shift.shift_date, shift.start_time, timeZone)).getTime()
  const scheduledEndMs = new Date(zonedLocalToUtc(shift.shift_date, shift.end_time, timeZone)).getTime()

  const exact = sessions.find((session) => session.shiftId === shift.id)
  if (exact) return exact

  const candidates = sessions
    .filter((session) => {
      const startMs = new Date(session.checkInAt).getTime()
      const endMs = new Date(session.effectiveEndAt).getTime()
      return startMs <= scheduledEndMs + 12 * 3600000 && endMs >= scheduledStartMs - 6 * 3600000
    })
    .sort((left, right) => {
      const leftDiff = Math.abs(new Date(left.checkInAt).getTime() - scheduledStartMs)
      const rightDiff = Math.abs(new Date(right.checkInAt).getTime() - scheduledStartMs)
      return leftDiff - rightDiff
    })

  return candidates[0] ?? null
}

function formatShiftDate(shiftDate: string) {
  try {
    const value = new Date(`${shiftDate}T12:00:00`)
    return value.toLocaleDateString("es-CO", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
  } catch {
    return shiftDate
  }
}

async function sendPush(messages: { to: string; title: string; body: string; data?: Record<string, unknown> }[]) {
  if (messages.length === 0) return []

  const invalidTokens = new Set<string>()
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100)
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    })
    const payload = await response.json()
    const data = Array.isArray(payload?.data) ? payload.data : []
    data.forEach((item: any, index: number) => {
      if (item?.status === "error" && item?.details?.error === "DeviceNotRegistered") {
        const token = chunk[index]?.to
        if (token) invalidTokens.add(token)
      }
    })
  }

  return Array.from(invalidTokens)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const timeZone = Deno.env.get("SHIFT_RUNTIME_TIME_ZONE") ?? DEFAULT_TIME_ZONE

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: secretRow, error: secretError } = await supabase
    .from("internal_job_secrets")
    .select("secret_value")
    .eq("key", "shift_runtime_processor_cron")
    .limit(1)
    .maybeSingle<InternalJobSecretRow>()

  if (secretError) {
    return new Response(JSON.stringify({ error: secretError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const expectedCronSecret =
    String(secretRow?.secret_value ?? "").trim() || String(Deno.env.get("SHIFT_RUNTIME_CRON_SECRET") ?? "").trim()

  if (expectedCronSecret && req.headers.get("x-cron-key") !== expectedCronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const todayKey = formatDateKeyInTimeZone(now, timeZone)
  const fromDate = addDaysToDateKey(todayKey, -LOOKBACK_DAYS)
  const toDate = addDaysToDateKey(todayKey, LOOKAHEAD_DAYS)

  const { data: policyData, error: policyError } = await supabase
    .from("shift_policy")
    .select(
      "end_reminder_minutes_before_end, end_reminder_minutes_after_end, auto_checkout_grace_minutes_after_end, end_reminder_enabled, scheduled_auto_checkout_enabled",
    )
    .limit(1)
    .maybeSingle<ShiftPolicyRow>()

  if (policyError) {
    return new Response(JSON.stringify({ error: policyError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const policy = policyData ?? null
  const reminderMinutes = Math.max(
    0,
    Number(policy?.end_reminder_minutes_before_end ?? DEFAULT_REMINDER_MINUTES) || DEFAULT_REMINDER_MINUTES,
  )
  const followupReminderDelayMinutes = Math.max(
    0,
    Number(policy?.auto_checkout_grace_minutes_after_end ?? DEFAULT_AUTO_CLOSE_GRACE_MINUTES) ||
      DEFAULT_AUTO_CLOSE_GRACE_MINUTES,
  )
  const reminderAfterMinutes =
    policy?.end_reminder_minutes_after_end != null
      ? Math.max(0, Number(policy.end_reminder_minutes_after_end))
      : null
  const reminderEnabled = policy?.end_reminder_enabled !== false
  // Business decision: scheduled auto-checkout by time is disabled.
  // Open shifts are only reminded; automatic checkout must come from geofence departure flow.
  const autoCloseEnabled = false

  if (!reminderEnabled && !autoCloseEnabled) {
    return new Response(JSON.stringify({ processed: 0, reason: "runtime_disabled" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { data: shifts, error: shiftsError } = await supabase
    .from("employee_shifts")
    .select("id, employee_id, site_id, shift_date, start_time, end_time, shift_kind, employees!employee_shifts_employee_id_fkey(full_name), sites!employee_shifts_site_id_fkey(name)")
    .not("published_at", "is", null)
    .neq("status", "cancelled")
    .neq("shift_kind", "descanso")
    .gte("shift_date", fromDate)
    .lte("shift_date", toDate)
    .order("shift_date", { ascending: true })
    .order("end_time", { ascending: true })

  if (shiftsError) {
    return new Response(JSON.stringify({ error: shiftsError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const shiftRows = (shifts ?? []) as ShiftRow[]
  if (shiftRows.length === 0) {
    return new Response(JSON.stringify({ processed: 0, reminders: 0, autoClosed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const shiftIds = shiftRows.map((shift) => shift.id)
  const employeeIds = Array.from(new Set(shiftRows.map((shift) => shift.employee_id)))

  const [
    { data: runtimeEvents, error: runtimeEventsError },
    { data: logs, error: logsError },
    { data: tokens, error: tokensError },
  ] = await Promise.all([
    supabase
      .from("shift_runtime_events")
      .select("shift_id, event_type")
      .in("shift_id", shiftIds),
    supabase
      .from("attendance_logs")
      .select("employee_id, site_id, action, occurred_at, shift_id")
      .in("employee_id", employeeIds)
      .gte("occurred_at", addDaysToDateKey(todayKey, -LOOKBACK_DAYS) + "T00:00:00.000Z")
      .lte("occurred_at", nowIso)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("employee_push_tokens")
      .select("token, employee_id")
      .eq("is_active", true)
      .in("employee_id", employeeIds),
  ])

  if (runtimeEventsError) {
    return new Response(JSON.stringify({ error: runtimeEventsError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
  if (logsError) {
    return new Response(JSON.stringify({ error: logsError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
  if (tokensError) {
    return new Response(JSON.stringify({ error: tokensError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const existingEventKeys = new Set(
    ((runtimeEvents ?? []) as RuntimeEventRow[]).map((row) => `${row.shift_id}|${row.event_type}`),
  )

  const logsByEmployeeSite = new Map<string, AttendanceLogRow[]>()
  ;((logs ?? []) as AttendanceLogRow[]).forEach((row) => {
    const key = `${row.employee_id}|${row.site_id}`
    const list = logsByEmployeeSite.get(key) ?? []
    list.push(row)
    logsByEmployeeSite.set(key, list)
  })

  const tokensByEmployee = new Map<string, string[]>()
  ;((tokens ?? []) as TokenRow[]).forEach((row) => {
    const list = tokensByEmployee.get(row.employee_id) ?? []
    list.push(row.token)
    tokensByEmployee.set(row.employee_id, list)
  })

  let reminderCount = 0
  let autoClosedCount = 0
  let skippedCount = 0
  const pushMessages: { to: string; title: string; body: string; data?: Record<string, unknown> }[] = []
  const pendingRuntimeInserts: Array<Record<string, unknown>> = []

  for (const shift of shiftRows) {
    const scheduledEndAt = zonedLocalToUtc(shift.shift_date, shift.end_time, timeZone)
    const scheduledEndMs = new Date(scheduledEndAt).getTime()
    const reminderAtMs = scheduledEndMs - reminderMinutes * 60000
    const followupReminderAtMs = scheduledEndMs + followupReminderDelayMinutes * 60000
    const reminderWindowEndMs =
      reminderAfterMinutes != null
        ? Math.min(scheduledEndMs + reminderAfterMinutes * 60000, followupReminderAtMs)
        : followupReminderAtMs
    const logsKey = `${shift.employee_id}|${shift.site_id}`
    const employeeLogs = logsByEmployeeSite.get(logsKey) ?? []
    const sessions = buildLogSessions(employeeLogs, nowIso)
    const matchedSession = matchSessionToShift(shift, sessions, timeZone)
    const isOpen = matchedSession?.status === "Abierto"

    if (
      reminderEnabled &&
      isOpen &&
      now.getTime() >= reminderAtMs &&
      now.getTime() < reminderWindowEndMs &&
      !existingEventKeys.has(`${shift.id}|end_reminder_sent`)
    ) {
      const tokensForEmployee = tokensByEmployee.get(shift.employee_id) ?? []
      const siteName = unwrapRelation(shift.sites)?.name ?? "tu sede"
      const detail = `${formatShiftDate(shift.shift_date)}, ${shift.end_time.slice(0, 5)}`
      const hasTokens = tokensForEmployee.length > 0

      if (hasTokens) {
        tokensForEmployee.forEach((token) => {
          pushMessages.push({
            to: token,
            title: "Se acerca el fin de tu turno",
            body: `Se acerca el fin de tu turno en ${siteName}. Recuerda realizar el cierre en la aplicación.`,
            data: {
              type: "shift_end_reminder",
              shift_id: shift.id,
              shift_date: shift.shift_date,
            },
          })
        })
      }

      if (hasTokens) {
        pendingRuntimeInserts.push({
          shift_id: shift.id,
          employee_id: shift.employee_id,
          site_id: shift.site_id,
          event_type: "end_reminder_sent",
          scheduled_for: new Date(reminderAtMs).toISOString(),
          processed_at: nowIso,
          status: "applied",
          notes: "push_sent",
          payload: {
            shift_date: shift.shift_date,
            end_time: shift.end_time,
            tokens: tokensForEmployee.length,
          },
        })
        existingEventKeys.add(`${shift.id}|end_reminder_sent`)
        reminderCount += 1
      } else {
        skippedCount += 1
      }
    }

    if (
      reminderEnabled &&
      isOpen &&
      now.getTime() >= followupReminderAtMs &&
      !existingEventKeys.has(`${shift.id}|end_reminder_followup_sent`)
    ) {
      const tokensForEmployee = tokensByEmployee.get(shift.employee_id) ?? []
      const siteName = unwrapRelation(shift.sites)?.name ?? "tu sede"
      const detail = `${formatShiftDate(shift.shift_date)}, ${shift.end_time.slice(0, 5)}`
      const hasTokens = tokensForEmployee.length > 0

      if (hasTokens) {
        pendingRuntimeInserts.push({
          shift_id: shift.id,
          employee_id: shift.employee_id,
          site_id: shift.site_id,
          event_type: "end_reminder_followup_sent",
          scheduled_for: new Date(followupReminderAtMs).toISOString(),
          processed_at: nowIso,
          status: "applied",
          notes: "push_sent_followup",
          payload: {
            shift_date: shift.shift_date,
            end_time: shift.end_time,
            tokens: tokensForEmployee.length,
          },
        })
        existingEventKeys.add(`${shift.id}|end_reminder_followup_sent`)

        tokensForEmployee.forEach((token) => {
          pushMessages.push({
            to: token,
            title: "Aún tienes el turno abierto",
            body: `Tu turno sigue abierto en ${siteName}. Recuerda realizar el cierre en la aplicación.`,
            data: {
              type: "shift_end_reminder_followup",
              shift_id: shift.id,
              shift_date: shift.shift_date,
            },
          })
        })
        reminderCount += 1
      } else {
        skippedCount += 1
      }
    }
  }

  const invalidTokens = await sendPush(pushMessages)

  if (pendingRuntimeInserts.length > 0) {
    const { error: insertError } = await supabase.from("shift_runtime_events").insert(pendingRuntimeInserts)
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  }

  if (invalidTokens.length > 0) {
    await supabase
      .from("employee_push_tokens")
      .update({ is_active: false })
      .in("token", invalidTokens)
  }

  return new Response(
    JSON.stringify({
      processed: shiftRows.length,
      reminders: reminderCount,
      autoClosed: autoClosedCount,
      skipped: skippedCount,
      pushes: pushMessages.length,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  )
})
