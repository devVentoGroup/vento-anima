import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const OWNER_ROLE = "propietario"

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders })
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405)
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const ownerDeleteUid = Deno.env.get("ANIMA_OWNER_DELETE_UID")

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Missing Supabase config" }, 500)
    }

    if (!ownerDeleteUid) {
      return jsonResponse({ error: "Missing ANIMA_OWNER_DELETE_UID" }, 500)
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    const accessToken = authHeader.replace("Bearer ", "")
    if (!accessToken) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
    const caller = authData?.user
    if (authError || !caller) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    if (caller.id !== ownerDeleteUid) {
      return jsonResponse({ error: "Forbidden" }, 403)
    }

    let payload: { target_employee_id?: string } = {}
    try {
      payload = await req.json()
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400)
    }

    const targetEmployeeId = payload.target_employee_id?.trim()
    if (!targetEmployeeId) {
      return jsonResponse({ error: "target_employee_id is required" }, 400)
    }

    if (targetEmployeeId === caller.id) {
      return jsonResponse({ error: "Cannot delete yourself" }, 400)
    }

    const { data: targetEmployee, error: targetError } = await supabase
      .from("employees")
      .select("id, role")
      .eq("id", targetEmployeeId)
      .maybeSingle()

    if (targetError) {
      return jsonResponse({ error: "Could not validate target employee" }, 500)
    }

    if (!targetEmployee) {
      return jsonResponse({ error: "Employee not found" }, 404)
    }

    if (targetEmployee.role === OWNER_ROLE) {
      return jsonResponse({ error: "Cannot delete another owner" }, 403)
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetEmployeeId)
    if (deleteError) {
      return jsonResponse(
        {
          error: "Delete failed",
          message: deleteError.message ?? String(deleteError),
        },
        400,
      )
    }

    return jsonResponse({
      success: true,
      deleted_employee_id: targetEmployeeId,
    })
  } catch (error) {
    return jsonResponse(
      {
        error: "Unexpected error",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})
