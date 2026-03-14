// Carnet laboral: endpoint para Apple Wallet en ANIMA (no vento-pass).
// Si tienes un servidor que genera .pkpass (p. ej. wallet-pass-api), configura
// EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE en la app para apuntar a esa URL.
// Este Edge Function no genera .pkpass (requiere certificados Apple y lógica Node);
// responde 501 hasta que se implemente generación aquí o se use un proxy a tu servidor.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      error: "Apple Wallet para carnet laboral no está disponible en este despliegue.",
      hint: "Configura EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE en la app para apuntar a un servidor que genere el .pkpass, o implementa la generación en este proyecto.",
    }),
    {
      status: 501,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  )
})
