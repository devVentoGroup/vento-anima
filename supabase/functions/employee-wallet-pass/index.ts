// Carnet laboral: pase de empleado para Google Wallet (endpoint de ANIMA, no vento-pass).
// Requiere elegibilidad (contrato activo + documentos completos).

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const pemToArrayBuffer = (pem: string) => {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "")
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID")
    const employeeClassId = Deno.env.get("GOOGLE_WALLET_EMPLOYEE_CLASS_ID")
    const serviceJson = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON")

    if (!issuerId || !employeeClassId || !serviceJson) {
      return new Response(
        JSON.stringify({ error: "Missing Google Wallet employee configuration (GOOGLE_WALLET_EMPLOYEE_CLASS_ID)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!bearer) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const userId = userRes.user.id

    const { data: eligibilityRows, error: eligErr } = await supabase.rpc("employee_wallet_eligibility", {
      p_employee_id: userId,
    })

    if (eligErr || !eligibilityRows || eligibilityRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No se pudo verificar elegibilidad." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const eligibility = eligibilityRows[0] as {
      wallet_eligible: boolean
      contract_active: boolean
      documents_complete: boolean
      contract_start_date: string | null
      contract_end_date: string | null
    }

    if (!eligibility.wallet_eligible) {
      return new Response(
        JSON.stringify({
          error: "No elegible para carnet.",
          reason: !eligibility.contract_active
            ? "Sin contrato vigente."
            : !eligibility.documents_complete
              ? "Faltan documentos requeridos."
              : "Revisa tu estado en la app.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const { data: employee, error: empErr } = await supabase
      .from("employees")
      .select("id, full_name, role, site_id, site:sites!employees_site_id_fkey(name)")
      .eq("id", userId)
      .maybeSingle()

    if (empErr || !employee) {
      return new Response(
        JSON.stringify({ error: "No se encontró el empleado." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const site = Array.isArray((employee as { site?: unknown }).site)
      ? ((employee as { site: unknown[] }).site[0] as { name?: string } | null)
      : ((employee as { site?: { name?: string } }).site ?? null)
    const siteName = site?.name ?? "Sede"
    const accountName = (employee as { full_name?: string }).full_name ?? "Empleado"
    const role = (employee as { role?: string }).role ?? ""

    const service = JSON.parse(serviceJson)
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      pemToArrayBuffer(service.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    )

    const objectId = `${issuerId}.emp.${userId}`
    const genericObject = {
      id: objectId,
      classId: `${issuerId}.${employeeClassId}`,
      state: "ACTIVE",
      cardTitle: "Carnet laboral",
      subheader: role || "Empleado",
      hexBackgroundColor: "#ffffff",
      logo: {
        sourceUri: {
          uri: "https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg",
          description: "Logo",
        },
      },
      textModulesData: [
        { header: "Nombre", body: accountName, id: "name" },
        { header: "Cargo", body: role || "-", id: "role" },
        { header: "Sede", body: siteName, id: "site" },
        {
          header: "Vigencia",
          body:
            eligibility.contract_start_date && eligibility.contract_end_date
              ? `${eligibility.contract_start_date} - ${eligibility.contract_end_date}`
              : "Vigente",
          id: "vigencia",
        },
      ],
      barcode: {
        type: "QR_CODE",
        value: `emp:${userId}`,
        alternateText: accountName,
        format: "QR_CODE",
      },
    }

    const jwtPayload = {
      iss: service.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: getNumericDate(new Date()),
      exp: getNumericDate(new Date(Date.now() + 5 * 60 * 1000)),
      payload: {
        genericObjects: [genericObject],
      },
    }

    const jwt = await create({ alg: "RS256", typ: "JWT" }, jwtPayload, privateKey)
    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`

    await supabase.rpc("employee_wallet_mark_issued", { p_employee_id: userId })

    return new Response(
      JSON.stringify({ saveUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
