/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
const ALLOWED_ROLES = new Set(["propietario", "gerente_general", "gerente"])

async function sendPush(
  messages: { to: string; title: string; body: string; data?: Record<string, unknown> }[],
) {
  if (messages.length === 0) return []
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  })
  const payload = await res.json()
  const data = Array.isArray(payload?.data) ? payload.data : []
  const invalidTokens: string[] = []
  data.forEach((item: { status?: string; details?: { error?: string } }, index: number) => {
    if (item?.status === "error" && item?.details?.error === "DeviceNotRegistered") {
      const token = messages[index]?.to
      if (token) invalidTokens.push(token)
    }
  })
  return invalidTokens
}

function formatShiftDate(shiftDate: string): string {
  if (!shiftDate) return ""
  try {
    const d = new Date(shiftDate + "T12:00:00")
    return d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })
  } catch {
    return shiftDate
  }
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

  const internalSecret = req.headers.get("x-internal-secret") ?? ""
  const isInternalCall =
    typeof Deno.env.get("INTERNAL_NOTIFY_SECRET") === "string" &&
    internalSecret !== "" &&
    internalSecret === Deno.env.get("INTERNAL_NOTIFY_SECRET")

  if (!isInternalCall) {
    const authHeader = req.headers.get("Authorization") ?? ""
    const token = authHeader.replace("Bearer ", "")
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: sender } = await supabase
      .from("employees")
      .select("id, role, is_active")
      .eq("id", authData.user.id)
      .maybeSingle()

    if (!sender || !sender.is_active || !ALLOWED_ROLES.has(sender.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  }

  let body: {
    employee_id?: string
    shift_id?: string
    shift_date?: string
    start_time?: string
    end_time?: string
    type?: "published" | "updated"
  } = {}
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const employeeId = body.employee_id?.trim()
  const type = body.type === "updated" ? "updated" : "published"
  const shiftDate = body.shift_date?.trim() ?? ""
  const startTime = body.start_time?.trim()?.slice(0, 5) ?? ""
  const endTime = body.end_time?.trim()?.slice(0, 5) ?? ""

  if (!employeeId) {
    return new Response(JSON.stringify({ error: "Missing employee_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { data: tokens, error: tokensError } = await supabase
    .from("employee_push_tokens")
    .select("token")
    .eq("employee_id", employeeId)
    .eq("is_active", true)

  if (tokensError) {
    return new Response(JSON.stringify({ error: tokensError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const tokenList = (tokens ?? []).map((r: { token: string }) => r.token).filter(Boolean)
  if (tokenList.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const dateLabel = formatShiftDate(shiftDate)
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : ""
  const detail = [dateLabel, timeRange].filter(Boolean).join(", ")

  const title = type === "published" ? "Tienes un turno nuevo" : "Tu turno fue actualizado"
  const bodyText =
    type === "published"
      ? detail ? `Tu turno: ${detail}` : "Revisa Mis turnos en ANIMA."
      : detail ? `Tu turno del ${detail} fue modificado.` : "Revisa Mis turnos en ANIMA."

  const messages = tokenList.map((t) => ({
    to: t,
    title,
    body: bodyText,
    data: {
      type: "shift_update",
      event: type,
      shift_id: body.shift_id ?? null,
      shift_date: shiftDate,
    },
  }))

  const invalidTokens = await sendPush(messages)
  if (invalidTokens.length > 0) {
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
