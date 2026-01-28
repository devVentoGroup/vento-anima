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

  let payload: {
    token?: string
    password?: string
    full_name?: string | null
    alias?: string | null
  } = {}

  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const token = payload.token?.trim()
  const password = payload.password

  if (!token || !password) {
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

  const { data: invite, error: inviteError } = await supabase
    .from("staff_invitations")
    .select(
      "id, email, full_name, staff_site_id, staff_role, status, expires_at",
    )
    .eq("token", token)
    .maybeSingle()

  if (inviteError || !invite) {
    return new Response(JSON.stringify({ error: "Invitation not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (invite.status !== "pending") {
    return new Response(JSON.stringify({ error: "Invitation already used" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: "Invitation expired" }), {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!invite.email || !invite.staff_site_id || !invite.staff_role) {
    return new Response(JSON.stringify({ error: "Invitation incomplete" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const fullName = (payload.full_name ?? invite.full_name ?? "").trim()
  if (!fullName) {
    return new Response(JSON.stringify({ error: "Missing full name" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let userId: string | null = null
  const now = new Date().toISOString()

  try {
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
      })

    if (createError || !created?.user) {
      return new Response(
        JSON.stringify({ error: createError?.message ?? "User create failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    userId = created.user.id

    const { error: employeeError } = await supabase.from("employees").insert({
      id: userId,
      full_name: fullName,
      alias: payload.alias ?? null,
      role: invite.staff_role,
      site_id: invite.staff_site_id,
      is_active: true,
      joined_at: now,
      updated_at: now,
    })

    if (employeeError) throw employeeError

    const { error: siteError } = await supabase.from("employee_sites").upsert(
      {
        employee_id: userId,
        site_id: invite.staff_site_id,
        is_primary: true,
        is_active: true,
      },
      { onConflict: "employee_id,site_id" },
    )

    if (siteError) throw siteError

    const { error: updateError } = await supabase
      .from("staff_invitations")
      .update({ status: "accepted", accepted_at: now })
      .eq("id", invite.id)

    if (updateError) throw updateError
  } catch (err) {
    if (userId) {
      await supabase.from("employee_sites").delete().eq("employee_id", userId)
      await supabase.from("employees").delete().eq("id", userId)
      await supabase.auth.admin.deleteUser(userId)
    }

    const message =
      err instanceof Error ? err.message : "Invitation activation failed"
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "User create failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ user_id: userId, email: invite.email }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
