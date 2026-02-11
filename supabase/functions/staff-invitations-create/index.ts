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

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, role, site_id")
    .eq("id", userData.user.id)
    .maybeSingle()

  if (!employee || !MANAGEMENT_ROLES.has(employee.role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let payload: {
    email?: string
    full_name?: string | null
    role?: string
    site_id?: string
    expires_days?: number
  } = {}

  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const email = payload.email?.trim()
  const role = payload.role?.trim()
  const siteId = payload.site_id?.trim()

  if (!email || !role || !siteId) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
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

  if (employee.role === GLOBAL_MANAGER_ROLE) {
    if (role === OWNER_ROLE || role === GLOBAL_MANAGER_ROLE) {
      return new Response(JSON.stringify({ error: "Forbidden role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  } else if (employee.role === MANAGER_ROLE) {
    if (MANAGEMENT_ROLES.has(role)) {
      return new Response(JSON.stringify({ error: "Forbidden role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    if (!employee.site_id || employee.site_id !== siteId) {
      return new Response(JSON.stringify({ error: "Forbidden site" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, is_active")
    .eq("id", siteId)
    .maybeSingle()

  if (!site || site.is_active === false) {
    return new Response(JSON.stringify({ error: "Invalid site" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const setPasswordWebUrl =
    Deno.env.get("SET_PASSWORD_WEB_URL") ??
    Deno.env.get("EXPO_PUBLIC_ANIMA_AUTH_REDIRECT_URL") ??
    Deno.env.get("INVITE_REDIRECT_URL") ??
    ""

  if (!setPasswordWebUrl) {
    return new Response(
      JSON.stringify({
        error:
          "Configura SET_PASSWORD_WEB_URL o EXPO_PUBLIC_ANIMA_AUTH_REDIRECT_URL (URL de la página web de crear contraseña, ej. https://tu-dominio.vercel.app/api/set-password).",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
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
      return new Response(JSON.stringify({ error: raw }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
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
      const authUser = listData?.users?.find((u) => u.email === email)
      if (authUser?.id) {
        existingUserId = authUser.id
        const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>
        if (!existingFullName && typeof meta.full_name === "string") {
          existingFullName = meta.full_name.trim()
        }
      }
    }
    if (!existingUserId) {
      return new Response(
        JSON.stringify({
          error:
            "Este correo ya está registrado pero no pudimos vincular la cuenta. Intenta más tarde o asígnalo desde Equipo.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
      return new Response(JSON.stringify({ error: clearPrimaryError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
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
      return new Response(JSON.stringify({ error: employeeError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
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
      return new Response(JSON.stringify({ error: siteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        added_to_team: true,
        email,
        message:
          "Ya tenía cuenta. Se agregó al equipo. Indícale que si solo entra con código (ej. en Vento Pass), puede usar «¿Olvidaste tu contraseña?» en el login de ANIMA para crear una contraseña.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
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
    return new Response(
      JSON.stringify({ error: "No se pudo generar el enlace de invitación" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
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
    return new Response(JSON.stringify({ error: empErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
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
    return new Response(JSON.stringify({ error: siteErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const resendKey = Deno.env.get("RESEND_API_KEY")
  const fromEmail =
    Deno.env.get("ANIMA_INVITE_FROM_EMAIL") ?? "ANIMA <onboarding@resend.dev>"

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
      return new Response(
        JSON.stringify({
          error: "No se pudo enviar el correo",
          details: errText.slice(0, 200),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }
  } else {
    return new Response(
      JSON.stringify({
        error:
          "Configura RESEND_API_KEY (y opcionalmente ANIMA_INVITE_FROM_EMAIL) para enviar la invitación por correo. En Supabase: Secrets de la función.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }

  return new Response(
    JSON.stringify({
      invited: true,
      email,
      invite_user_id: newUserId,
      set_password_url: setPasswordWebUrl || null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  )
})
