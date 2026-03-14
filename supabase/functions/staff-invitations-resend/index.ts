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

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
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
    .select(`
      id,
      email,
      full_name,
      status,
      resend_count,
      role_code,
      staff_role,
      site_id,
      staff_site_id,
      auth_user_id,
      employee_id
    `)
    .eq("id", invitationId)
    .maybeSingle()

  if (invitationError) {
    return buildJsonResponse({ error: invitationError.message }, 500)
  }

  if (!invitation) {
    return buildJsonResponse({ error: "Invitation not found" }, 404)
  }

  const siteId = String(invitation.site_id ?? invitation.staff_site_id ?? "").trim()
  const role = String(invitation.role_code ?? invitation.staff_role ?? "").trim()
  const email = String(invitation.email ?? "").trim().toLowerCase()
  const fullName = invitation.full_name ? String(invitation.full_name).trim() : null

  if (!siteId || !role || !email) {
    return buildJsonResponse({ error: "Invitation data incomplete" }, 400)
  }

  if (employee.role === MANAGER_ROLE && employee.site_id !== siteId) {
    return buildJsonResponse({ error: "Forbidden site" }, 403)
  }

  if (invitation.status === "accepted") {
    return buildJsonResponse({ error: "Invitation already accepted" }, 409)
  }

  if (invitation.status === "cancelled") {
    return buildJsonResponse({ error: "Invitation cancelled" }, 409)
  }

  if (invitation.status === "linked_existing_user") {
    return buildJsonResponse(
      {
        error:
          "Este usuario ya existía en el sistema. Indícale que use «¿Olvidaste tu contraseña?» en ANIMA si necesita crear una contraseña.",
      },
      409,
    )
  }

  const setPasswordWebUrl =
    Deno.env.get("SET_PASSWORD_WEB_URL") ??
    Deno.env.get("EXPO_PUBLIC_ANIMA_AUTH_REDIRECT_URL") ??
    Deno.env.get("INVITE_REDIRECT_URL") ??
    ""

  if (!setPasswordWebUrl) {
    return buildJsonResponse(
      {
        error:
          "Configura SET_PASSWORD_WEB_URL o EXPO_PUBLIC_ANIMA_AUTH_REDIRECT_URL antes de reenviar invitaciones.",
      },
      500,
    )
  }

  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: setPasswordWebUrl || undefined,
        data: {
          role,
          site_id: siteId,
          full_name: fullName,
        },
      },
    })

  if (linkError) {
    return buildJsonResponse({ error: linkError.message ?? "Invite link failed" }, 400)
  }

  const linkProps =
    (linkData as {
      properties?: {
        action_link?: string
        hashed_token?: string
        verification_type?: string
      }
    })?.properties ?? null
  const actionLink = linkProps?.action_link ?? null
  const hashedToken = linkProps?.hashed_token ?? null
  const verificationType = linkProps?.verification_type ?? "invite"
  const normalizedSetPasswordUrl = setPasswordWebUrl.replace(/\/+$/, "")
  const tokenHashLink =
    hashedToken
      ? `${normalizedSetPasswordUrl}?token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(verificationType)}`
      : null
  const emailActionLink = tokenHashLink || actionLink

  if (!emailActionLink) {
    return buildJsonResponse({ error: "No invite link generated" }, 500)
  }

  const resendKey = Deno.env.get("RESEND_API_KEY")
  const fromEmail =
    Deno.env.get("ANIMA_INVITE_FROM_EMAIL") ?? "ANIMA <onboarding@resend.dev>"

  if (!resendKey) {
    return buildJsonResponse(
      {
        error:
          "Configura RESEND_API_KEY (y opcionalmente ANIMA_INVITE_FROM_EMAIL) para reenviar la invitación.",
      },
      500,
    )
  }

  const inviteSubject = "Invitación a ANIMA – Crear contraseña"
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invitación ANIMA</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;background:#f5f5f5;">
  <div style="max-width:400px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <h1 style="font-size:1.35rem;margin:0 0 8px;color:#1a1a1a;">Invitación a ANIMA</h1>
    <p style="color:#666;font-size:0.95rem;margin-bottom:20px;">Te reenviamos el acceso para crear tu contraseña y empezar a usar ANIMA.</p>
    <p style="margin:24px 0;"><a href="${emailActionLink}" style="display:inline-block;padding:14px 24px;background:#e2006a;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">Crear contraseña</a></p>
    <p style="color:#888;font-size:0.85rem;">Si el botón no funciona, copia y pega este enlace en el navegador:</p>
    <p style="word-break:break-all;font-size:0.8rem;color:#666;">${emailActionLink}</p>
  </div>
</body>
</html>`

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: inviteSubject,
      html,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    return buildJsonResponse(
      {
        error: "No se pudo reenviar el correo",
        details: errText.slice(0, 200),
      },
      500,
    )
  }

  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const inviteTokenHash = hashedToken ? await sha256Hex(hashedToken) : null
  const resendCount = Number(invitation.resend_count ?? 0) + 1

  const { error: updateError } = await supabase
    .from("staff_invitations")
    .update({
      status: "sent",
      last_sent_at: now,
      expires_at: expiresAt,
      expired_at: expiresAt,
      resend_count: resendCount,
      invite_token_hash: inviteTokenHash,
      updated_at: now,
      metadata: {
        source: "staff-invitations-resend",
        verification_type: verificationType,
        resent_by: userData.user.id,
      },
    })
    .eq("id", invitationId)

  if (updateError) {
    return buildJsonResponse({ error: updateError.message }, 500)
  }

  return buildJsonResponse({
    ok: true,
    invitation_id: invitationId,
    status: "sent",
    resend_count: resendCount,
    email,
    message: "Invitación reenviada correctamente.",
  })
})
