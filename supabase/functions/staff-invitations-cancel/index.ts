/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — Edge Function de Deno; el IDE usa Node y marca errores falsos. Al desplegar en Supabase funciona.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const OWNER_ROLE = "propietario"
const GLOBAL_MANAGER_ROLE = "gerente_general"
const MANAGER_ROLE = "gerente"
const MANAGEMENT_ROLES = new Set([OWNER_ROLE, GLOBAL_MANAGER_ROLE, MANAGER_ROLE])

function buildJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return buildJsonResponse({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !serviceKey) {
    return buildJsonResponse({ error: "Missing Supabase config" }, 500)
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.replace("Bearer ", "").trim()
  if (!token) {
    return buildJsonResponse({ error: "Unauthorized" }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return buildJsonResponse({ error: "Unauthorized" }, 401)
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, role, site_id")
    .eq("id", userData.user.id)
    .maybeSingle()

  if (!employee || !MANAGEMENT_ROLES.has(employee.role)) {
    return buildJsonResponse({ error: "Forbidden" }, 403)
  }

  let payload: { staff_invitation_id?: string } = {}
  try {
    payload = await req.json()
  } catch {
    return buildJsonResponse({ error: "Invalid JSON" }, 400)
  }

  const invitationId = String(payload.staff_invitation_id ?? "").trim()
  if (!invitationId) {
    return buildJsonResponse({ error: "Missing invitation id" }, 400)
  }

  const { data: invitation, error: invitationError } = await supabase
    .from("staff_invitations")
    .select("id, status, site_id, staff_site_id")
    .eq("id", invitationId)
    .maybeSingle()

  if (invitationError) {
    return buildJsonResponse({ error: invitationError.message }, 500)
  }

  if (!invitation) {
    return buildJsonResponse({ error: "Invitation not found" }, 404)
  }

  const siteId = String(invitation.site_id ?? invitation.staff_site_id ?? "").trim()
  if (employee.role === MANAGER_ROLE && employee.site_id !== siteId) {
    return buildJsonResponse({ error: "Forbidden site" }, 403)
  }

  if (invitation.status === "accepted") {
    return buildJsonResponse({ error: "Accepted invitations cannot be cancelled" }, 409)
  }

  if (invitation.status === "cancelled") {
    return buildJsonResponse(
      {
        ok: true,
        invitation_id: invitationId,
        status: "cancelled",
        message: "La invitación ya estaba cancelada.",
      },
      200,
    )
  }

  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from("staff_invitations")
    .update({
      status: "cancelled",
      cancelled_at: now,
      updated_at: now,
      metadata: {
        source: "staff-invitations-cancel",
        cancelled_by: userData.user.id,
      },
    })
    .eq("id", invitationId)

  if (updateError) {
    return buildJsonResponse({ error: updateError.message }, 500)
  }

  return buildJsonResponse({
    ok: true,
    invitation_id: invitationId,
    status: "cancelled",
    message: "Invitación cancelada correctamente.",
  })
})
