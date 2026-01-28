import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
const DEFAULT_REMINDER_DAYS = 7
const LOOKAHEAD_DAYS = 120

type DocumentRow = {
  id: string
  title: string | null
  scope: string
  expiry_date: string | null
  status: string
  owner_employee_id: string | null
  target_employee_id: string | null
  document_type: { name: string | null; reminder_days: number | null } | null
}

type TokenRow = { token: string; employee_id: string }

function parseDateOnlyUtc(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1))
}

function formatDateOnlyUtc(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

async function sendPush(messages: { to: string; title: string; body: string; data?: Record<string, unknown> }[]) {
  const chunks: { to: string; title: string; body: string; data?: Record<string, unknown> }[][] = []
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100))
  }

  const invalidTokens = new Set<string>()

  for (const chunk of chunks) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    })
    const payload = await res.json()
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

  const cronSecret = Deno.env.get("DOCUMENT_ALERTS_CRON_SECRET")
  if (cronSecret && req.headers.get("x-cron-key") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const today = formatDateOnlyUtc(new Date())
  const lookahead = formatDateOnlyUtc(
    addDaysUtc(parseDateOnlyUtc(today), LOOKAHEAD_DAYS),
  )

  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select(
      "id, title, scope, expiry_date, status, owner_employee_id, target_employee_id, document_type:document_types (name, reminder_days)",
    )
    .not("expiry_date", "is", null)
    .neq("status", "rejected")
    .gte("expiry_date", today)
    .lte("expiry_date", lookahead)

  if (docsError) {
    return new Response(JSON.stringify({ error: docsError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const targets: {
    docId: string
    employeeId: string
    title: string
    expiryDate: string
  }[] = []

  for (const doc of (docs as DocumentRow[]) ?? []) {
    if (!doc.expiry_date) continue
    const reminderDays =
      doc.document_type?.reminder_days ?? DEFAULT_REMINDER_DAYS
    const expiry = parseDateOnlyUtc(doc.expiry_date)
    const reminderDate = addDaysUtc(expiry, -reminderDays)

    if (formatDateOnlyUtc(reminderDate) !== today) continue

    const employeeId =
      doc.scope === "employee"
        ? doc.target_employee_id ?? doc.owner_employee_id
        : doc.owner_employee_id

    if (!employeeId) continue

    targets.push({
      docId: doc.id,
      employeeId,
      title: doc.document_type?.name ?? doc.title ?? "Documento",
      expiryDate: doc.expiry_date,
    })
  }

  if (targets.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const employeeIds = Array.from(new Set(targets.map((t) => t.employeeId)))

  const { data: tokens, error: tokensError } = await supabase
    .from("employee_push_tokens")
    .select("token, employee_id")
    .eq("is_active", true)
    .in("employee_id", employeeIds)

  if (tokensError) {
    return new Response(JSON.stringify({ error: tokensError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const tokensByEmployee = new Map<string, string[]>()
  ;(tokens as TokenRow[]).forEach((row) => {
    const list = tokensByEmployee.get(row.employee_id) ?? []
    list.push(row.token)
    tokensByEmployee.set(row.employee_id, list)
  })

  const messages: { to: string; title: string; body: string; data?: Record<string, unknown> }[] = []

  for (const target of targets) {
    const tokenList = tokensByEmployee.get(target.employeeId) ?? []
    tokenList.forEach((token) => {
      messages.push({
        to: token,
        title: "Documento por vencer",
        body: `${target.title}. Vence el ${target.expiryDate}.`,
        data: { documentId: target.docId },
      })
    })
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const invalidTokens = await sendPush(messages)

  if (invalidTokens.length) {
    await supabase
      .from("employee_push_tokens")
      .update({ is_active: false })
      .in("token", invalidTokens)
  }

  return new Response(JSON.stringify({ sent: messages.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
