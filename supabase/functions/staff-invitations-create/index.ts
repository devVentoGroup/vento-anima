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

async function getLatestInvitation(
  supabase: ReturnType<typeof createClient>,
  email: string,
  siteId: string,
) {
  const { data } = await supabase
    .from("staff_invitations")
    .select("id, status, resend_count")
    .eq("email", email)
    .or(`site_id.eq.${siteId},staff_site_id.eq.${siteId}`)
    .order("created_at", { ascending: false })
    .limit(1)

  return Array.isArray(data) ? data[0] ?? null : null
}

async function persistInvitationRecord(
  supabase: ReturnType<typeof createClient>,
  params: {
    email: string
    fullName: string | null
    role: string
    siteId: string
    invitedBy: string
    status:
      | "sent"
      | "linked_existing_user"
      | "accepted"
      | "expired"
      | "cancelled"
      | "failed"
    authUserId?: string | null
    employeeId?: string | null
    inviteTokenHash?: string | null
    lastSentAt?: string | null
    expiredAt?: string | null
    notes?: string | null
    metadata?: Record<string, unknown>
    incrementResend?: boolean
  },
) {
  const existing = await getLatestInvitation(supabase, params.email, params.siteId)
  const now = new Date().toISOString()
  const resendCount =
    params.incrementResend && existing
      ? Number(existing.resend_count ?? 0) + 1
      : Number(existing?.resend_count ?? 0)

  const payload = {
    email: params.email,
    full_name: params.fullName,
    staff_role: params.role,
    role_code: params.role,
    staff_site_id: params.siteId,
    site_id: params.siteId,
    status: params.status,
    invited_by: params.invitedBy,
    created_by: params.invitedBy,
    invited_at: now,
    last_sent_at: params.lastSentAt ?? null,
    expired_at: params.expiredAt ?? null,
    expires_at: params.expiredAt ?? null,
    resend_count: resendCount,
    delivery_channel: "email",
    auth_user_id: params.authUserId ?? null,
    employee_id: params.employeeId ?? null,
    invite_token_hash: params.inviteTokenHash ?? null,
    notes: params.notes ?? null,
    metadata: params.metadata ?? {},
    source_app: "anima",
    updated_at: now,
  }

  if (existing?.id && existing.status !== "accepted" && existing.status !== "cancelled") {
    const { data, error } = await supabase
      .from("staff_invitations")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single()

    if (error) throw error
    return data?.id ?? existing.id
  }

  const { data, error } = await supabase
    .from("staff_invitations")
    .insert({
      token: params.inviteTokenHash ?? `legacy:${crypto.randomUUID()}`,
      ...payload,
    })
    .select("id")
    .single()

  if (error) throw error
  return data?.id ?? null
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
  const token = authHeader.replace("Bearer ", "")
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

  let payload: {
    email?: string
    full_name?: string | null
    role?: string
    site_id?: string
    expires_days?: number
    expires_at?: string
  } = {}

  try {
    payload = await req.json()
  } catch {
    return buildJsonResponse({ error: "Invalid JSON" }, 400)
  }

  const email = payload.email?.trim().toLowerCase()
  const role = payload.role?.trim()
  const siteId = payload.site_id?.trim()
  const expiresDays = Math.max(1, Math.min(30, Number(payload.expires_days ?? 7)))

  let expiredAt: string
  const expiresAtRaw = payload.expires_at?.trim()
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw)
    if (!Number.isNaN(parsed.getTime())) {
      expiredAt = parsed.toISOString()
    } else {
      expiredAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString()
    }
  } else {
    expiredAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString()
  }

  if (!email || !role || !siteId) {
    return buildJsonResponse({ error: "Missing fields" }, 400)
  }

  const { data: roleRow } = await supabase
    .from("roles")
    .select("code, is_active")
    .eq("code", role)
    .maybeSingle()

  if (!roleRow || roleRow.is_active === false) {
    return buildJsonResponse({ error: "Invalid role" }, 400)
  }

  if (employee.role === GLOBAL_MANAGER_ROLE) {
    if (role === OWNER_ROLE || role === GLOBAL_MANAGER_ROLE) {
      return buildJsonResponse({ error: "Forbidden role" }, 403)
    }
  } else if (employee.role === MANAGER_ROLE) {
    if (MANAGEMENT_ROLES.has(role)) {
      return buildJsonResponse({ error: "Forbidden role" }, 403)
    }
    if (!employee.site_id || employee.site_id !== siteId) {
      return buildJsonResponse({ error: "Forbidden site" }, 403)
    }
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return buildJsonResponse({ error: "Invalid email" }, 400)
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, is_active")
    .eq("id", siteId)
    .maybeSingle()

  if (!site || site.is_active === false) {
    return buildJsonResponse({ error: "Invalid site" }, 400)
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
          "Configura SET_PASSWORD_WEB_URL o EXPO_PUBLIC_ANIMA_AUTH_REDIRECT_URL (URL de la página web de crear contraseña, ej. https://tu-dominio.vercel.app/api/set-password).",
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
          full_name: payload.full_name ?? null,
        },
      },
    })

  if (linkError) {
    const raw = linkError.message ?? ""
    const isAlreadyRegistered =
      /already|duplicate|23505|already been registered|ya está registrado/i.test(
        raw,
      )
    if (!isAlreadyRegistered) {
      try {
        await persistInvitationRecord(supabase, {
          email,
          fullName: payload.full_name?.trim() || null,
          role,
          siteId,
          invitedBy: userData.user.id,
          status: "failed",
          expiredAt,
          metadata: { source: "staff-invitations-create", error: raw },
          notes: "Error generando link de invitación",
        })
      } catch (persistError) {
        console.error("[staff-invitations-create] persist failed:", persistError)
      }
      return buildJsonResponse({ error: raw }, 400)
    }

    // El correo ya está en Auth (ej. se registró en Vento Pass). Agregar a employees sin invitar.
    let existingUserId: string | null = null
    let existingFullName: string | null = payload.full_name?.trim() || null

    const { data: publicUser } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("email", email)
      .maybeSingle()
    if (publicUser?.id) {
      existingUserId = publicUser.id
      if (!existingFullName && publicUser.full_name) {
        existingFullName = String(publicUser.full_name).trim()
      }
    }
    if (!existingUserId) {
      const { data: listData } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 500,
      })
      const authUser = listData?.users?.find((u) => u.email?.toLowerCase() === email)
      if (authUser?.id) {
        existingUserId = authUser.id
        const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>
        if (!existingFullName && typeof meta.full_name === "string") {
          existingFullName = meta.full_name.trim()
        }
      }
    }
    if (!existingUserId) {
      return buildJsonResponse(
        {
          error:
            "Este correo ya está registrado pero no pudimos vincular la cuenta. Intenta más tarde o asígnalo desde Equipo.",
        },
        400,
      )
    }

    const now = new Date().toISOString()
    const fullName =
      existingFullName ||
      email.split("@")[0] ||
      "Empleado"

    const { error: clearPrimaryError } = await supabase
      .from("employee_sites")
      .update({ is_primary: false })
      .eq("employee_id", existingUserId)
      .eq("is_primary", true)
      .neq("site_id", siteId)
    if (clearPrimaryError) {
      return buildJsonResponse({ error: clearPrimaryError.message }, 500)
    }

    const { error: employeeError } = await supabase.from("employees").upsert(
      {
        id: existingUserId,
        full_name: fullName,
        alias: null,
        role,
        site_id: siteId,
        is_active: true,
        joined_at: now,
        updated_at: now,
      },
      { onConflict: "id" },
    )
    if (employeeError) {
      return buildJsonResponse({ error: employeeError.message }, 400)
    }

    const { error: siteError } = await supabase.from("employee_sites").upsert(
      {
        employee_id: existingUserId,
        site_id: siteId,
        is_primary: true,
        is_active: true,
      },
      { onConflict: "employee_id,site_id" },
    )
    if (siteError) {
      return buildJsonResponse({ error: siteError.message }, 500)
    }

    let invitationId: string | null = null
    try {
      invitationId = await persistInvitationRecord(supabase, {
        email,
        fullName,
        role,
        siteId,
        invitedBy: userData.user.id,
        status: "linked_existing_user",
        authUserId: existingUserId,
        employeeId: existingUserId,
        expiredAt,
        metadata: {
          source: "staff-invitations-create",
          existing_user_flow: true,
        },
        notes:
          "Usuario existente en Auth agregado al equipo. Si solo usa OTP en otra app, debe crear contraseña desde recuperación.",
      })
    } catch (persistError) {
      console.error("[staff-invitations-create] persist linked_existing_user failed:", persistError)
    }

    return buildJsonResponse({
      added_to_team: true,
      invitation_id: invitationId,
      status: "linked_existing_user",
      email,
      message:
        "Ya tenía cuenta. Se agregó al equipo. Indícale que si solo entra con código (ej. en Vento Pass), puede usar «¿Olvidaste tu contraseña?» en el login de ANIMA para crear una contraseña.",
    })
  }

  const newUserId = linkData?.user?.id ?? null
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

  if (!newUserId || !emailActionLink) {
    return buildJsonResponse(
      { error: "No se pudo generar el enlace de invitación" },
      500,
    )
  }

  const now = new Date().toISOString()
  const fullName =
    payload.full_name?.trim() ||
    (linkData.user?.user_metadata?.full_name as string)?.trim() ||
    email.split("@")[0] ||
    "Empleado"

  const { error: empErr } = await supabase.from("employees").upsert(
    {
      id: newUserId,
      full_name: fullName,
      alias: null,
      role,
      site_id: siteId,
      is_active: true,
      joined_at: now,
      updated_at: now,
    },
    { onConflict: "id" },
  )
  if (empErr) {
    return buildJsonResponse({ error: empErr.message }, 500)
  }

  const { error: siteErr } = await supabase.from("employee_sites").upsert(
    {
      employee_id: newUserId,
      site_id: siteId,
      is_primary: true,
      is_active: true,
    },
    { onConflict: "employee_id,site_id" },
  )
  if (siteErr) {
    return buildJsonResponse({ error: siteErr.message }, 500)
  }

  const resendKey = Deno.env.get("RESEND_API_KEY")
  const fromEmail =
    Deno.env.get("ANIMA_INVITE_FROM_EMAIL") ?? "ANIMA <onboarding@resend.dev>"
  const inviteTokenHash = hashedToken ? await sha256Hex(hashedToken) : null
  let invitationId: string | null = null

  try {
    invitationId = await persistInvitationRecord(supabase, {
      email,
      fullName,
      role,
      siteId,
      invitedBy: userData.user.id,
      status: "sent",
      authUserId: newUserId,
      employeeId: newUserId,
      inviteTokenHash,
      lastSentAt: now,
      expiredAt,
      metadata: {
        source: "staff-invitations-create",
        verification_type: verificationType,
      },
      incrementResend: true,
    })
  } catch (persistError) {
    console.error("[staff-invitations-create] persist sent failed:", persistError)
    return buildJsonResponse(
      { error: "No se pudo registrar la invitación operativa" },
      500,
    )
  }

  if (resendKey) {
    // Template del correo: puedes editar texto y estilos; no quites ${emailActionLink}.
    const inviteSubject = "Invitación a ANIMA – Crear contraseña"
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invitación ANIMA</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;background:#f5f5f5;">
  <div style="max-width:400px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <h1 style="font-size:1.35rem;margin:0 0 8px;color:#1a1a1a;">Invitación a ANIMA</h1>
    <p style="color:#666;font-size:0.95rem;margin-bottom:20px;">Te han invitado al equipo. Haz clic en el enlace para crear tu contraseña y empezar a usar ANIMA.</p>
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
      try {
        await persistInvitationRecord(supabase, {
          email,
          fullName,
          role,
          siteId,
          invitedBy: userData.user.id,
          status: "failed",
          authUserId: newUserId,
          employeeId: newUserId,
          inviteTokenHash,
          expiredAt,
          metadata: {
            source: "staff-invitations-create",
            email_send_error: errText.slice(0, 500),
          },
          notes: "Error enviando correo de invitación",
        })
      } catch (persistError) {
        console.error("[staff-invitations-create] persist failed email error failed:", persistError)
      }
      return buildJsonResponse(
        {
          error: "No se pudo enviar el correo",
          details: errText.slice(0, 200),
        },
        500,
      )
    }
  } else {
    try {
      await persistInvitationRecord(supabase, {
        email,
        fullName,
        role,
        siteId,
        invitedBy: userData.user.id,
        status: "failed",
        authUserId: newUserId,
        employeeId: newUserId,
        inviteTokenHash,
        expiredAt,
        metadata: {
          source: "staff-invitations-create",
          missing_secret: "RESEND_API_KEY",
        },
        notes: "No se pudo enviar el correo porque falta RESEND_API_KEY",
      })
    } catch (persistError) {
      console.error("[staff-invitations-create] persist missing resend failed:", persistError)
    }
    return buildJsonResponse(
      {
        error:
          "Configura RESEND_API_KEY (y opcionalmente ANIMA_INVITE_FROM_EMAIL) para enviar la invitación por correo. En Supabase: Secrets de la función.",
      },
      500,
    )
  }

  return buildJsonResponse({
    invited: true,
    invitation_id: invitationId,
    status: "sent",
    email,
    invite_user_id: newUserId,
    set_password_url: setPasswordWebUrl || null,
  })
})
