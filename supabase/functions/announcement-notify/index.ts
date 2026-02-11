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

type TokenRow = { token: string; employee_id: string }

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

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.replace("Bearer ", "")
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const senderId = authData.user.id
  const { data: sender } = await supabase
    .from("employees")
    .select("id, role, is_active")
    .eq("id", senderId)
    .maybeSingle()

  if (!sender || !sender.is_active || !ALLOWED_ROLES.has(sender.role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let payload: {
    announcement_id?: string
    title?: string
    body?: string
    tag?: string
  } = {}
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const title = payload.title?.trim()
  const body = payload.body?.trim()
  const announcementId = payload.announcement_id?.trim() || null
  const tag = payload.tag?.trim() || "INFO"

  if (!title || !body) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { data: activeEmployees, error: employeesError } = await supabase
    .from("employees")
    .select("id")
    .eq("is_active", true)

  if (employeesError) {
    return new Response(JSON.stringify({ error: employeesError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const employeeIds = (activeEmployees ?? [])
    .map((row: { id: string }) => row.id)
    .filter((id: string) => id && id !== senderId)

  if (employeeIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { data: tokens, error: tokensError } = await supabase
    .from("employee_push_tokens")
    .select("token, employee_id")
    .eq("is_active", true)
    .in("employee_id", employeeIds)

  if (tokensError) {
    return new Response(JSON.stringify({ error: tokensError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const messages = ((tokens ?? []) as TokenRow[]).map((row) => ({
    to: row.token,
    title: "Nueva novedad en ANIMA",
    body: `${title}`,
    data: {
      type: "announcement",
      announcementId,
      tag,
    },
  }))

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
