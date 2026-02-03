import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  const accessToken = authHeader.replace("Bearer ", "").trim()
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let payload: {
    password?: string
    full_name?: string | null
    alias?: string | null
    role?: string | null
    site_id?: string | null
  } = {}

  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const password = payload.password

  if (!password) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ error: "Weak password" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken)

  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const user = userData.user
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>

  const role = String(payload.role ?? meta.role ?? "").trim()
  const siteId = String(payload.site_id ?? meta.site_id ?? "").trim()

  if (!role || !siteId) {
    return new Response(JSON.stringify({ error: "Invitation incomplete" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { data: roleRow } = await supabase
    .from("roles")
    .select("code, is_active")
    .eq("code", role)
    .maybeSingle()

  if (!roleRow || roleRow.is_active === false) {
    return new Response(JSON.stringify({ error: "Invalid role" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { data: siteRow } = await supabase
    .from("sites")
    .select("id, is_active")
    .eq("id", siteId)
    .maybeSingle()

  if (!siteRow || siteRow.is_active === false) {
    return new Response(JSON.stringify({ error: "Invalid site" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let fullName = String(payload.full_name ?? meta.full_name ?? "").trim()
  if (!fullName) {
    if (user.email) {
      const { data: userProfile } = await supabase
        .from("users")
        .select("full_name")
        .eq("email", user.email)
        .maybeSingle()
      fullName = (userProfile?.full_name ?? "").trim()
    }
  }
  if (!fullName) {
    return new Response(JSON.stringify({ error: "Missing full name" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const now = new Date().toISOString()
  const aliasValue = String(
    payload.alias ?? (typeof meta.alias === "string" ? meta.alias : ""),
  ).trim()

  try {
    const mergedMeta = {
      ...meta,
      role,
      site_id: siteId,
      full_name: fullName,
      ...(aliasValue ? { alias: aliasValue } : {}),
    }

    const { error: updateAuthError } =
      await supabase.auth.admin.updateUserById(user.id, {
        password,
        user_metadata: mergedMeta,
      })

    if (updateAuthError) throw updateAuthError

    const { data: existingEmployee } = await supabase
      .from("employees")
      .select("id, joined_at, alias")
      .eq("id", user.id)
      .maybeSingle()

    const joinedAt = existingEmployee?.joined_at ?? now
    const finalAlias = aliasValue || existingEmployee?.alias || null

    const { error: employeeError } = await supabase.from("employees").upsert(
      {
        id: user.id,
        full_name: fullName,
        alias: finalAlias,
        role,
        site_id: siteId,
        is_active: true,
        joined_at: joinedAt,
        updated_at: now,
      },
      { onConflict: "id" },
    )

    if (employeeError) throw employeeError

    const { error: clearPrimaryError } = await supabase
      .from("employee_sites")
      .update({ is_primary: false })
      .eq("employee_id", user.id)
      .eq("is_primary", true)
      .neq("site_id", siteId)

    if (clearPrimaryError) throw clearPrimaryError

    const { error: siteError } = await supabase.from("employee_sites").upsert(
      {
        employee_id: user.id,
        site_id: siteId,
        is_primary: true,
        is_active: true,
      },
      { onConflict: "employee_id,site_id" },
    )

    if (siteError) throw siteError
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invitation activation failed"
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  return new Response(
    JSON.stringify({ user_id: user.id, email: user.email ?? null }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  )
})
