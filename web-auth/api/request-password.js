/**
 * Página para pedir el enlace de «crear contraseña» (ANIMA).
 * El usuario entra aquí (sin abrir la app), pone su correo, recibe el email y abre el enlace → set-password.
 * No requiere ningún build ni cambio en la app.
 *
 * Comparte esta URL con trabajadores: https://tu-dominio.vercel.app/api/request-password
 */

const getHtml = (supabaseUrl, supabaseAnonKey) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Crear contraseña – ANIMA</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #fff; border-radius: 16px; padding: 28px; max-width: 400px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    h1 { font-size: 1.35rem; margin: 0 0 8px; color: #1a1a1a; }
    .sub { color: #666; font-size: 0.9rem; margin-bottom: 20px; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: #333; margin-bottom: 6px; }
    input { width: 100%; padding: 12px 14px; border: 1px solid #ddd; border-radius: 10px; font-size: 1rem; margin-bottom: 14px; }
    button { width: 100%; padding: 14px; background: #e2006a; color: #fff; border: none; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; }
    button:hover { background: #c0005a; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .msg { margin-top: 14px; padding: 12px; border-radius: 10px; font-size: 0.9rem; display: none; }
    .msg.success { background: #e8f5e9; color: #2e7d32; display: block; }
    .msg.error { background: #ffebee; color: #c62828; display: block; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Crear contraseña para ANIMA</h1>
    <p class="sub">Si te agregaron al equipo y aún no tienes contraseña (o la olvidaste), escribe tu correo y te enviamos un enlace para crearla.</p>
    <form id="form">
      <label for="email">Correo</label>
      <input type="email" id="email" name="email" placeholder="tu@correo.com" required />
      <button type="submit" id="btn">Enviar enlace</button>
    </form>
    <div id="msg" class="msg" role="alert"></div>
  </div>
  <script>
    window.SUPABASE_URL = ${JSON.stringify(supabaseUrl || "")};
    window.SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey || "")};
  </script>
  <script>
    (function() {
      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        document.getElementById("msg").textContent = "Configuración del servidor incompleta.";
        document.getElementById("msg").className = "msg error";
        document.getElementById("msg").style.display = "block";
        return;
      }
      var supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      var form = document.getElementById("form");
      var btn = document.getElementById("btn");
      var msg = document.getElementById("msg");
      var setPasswordUrl = window.location.origin + "/api/set-password";

      form.addEventListener("submit", function(e) {
        e.preventDefault();
        var email = document.getElementById("email").value.trim();
        if (!email) return;
        btn.disabled = true;
        msg.className = "msg";
        msg.style.display = "none";
        supabase.auth.resetPasswordForEmail(email, { redirectTo: setPasswordUrl })
          .then(function(res) {
            if (res.error) {
              msg.className = "msg error";
              msg.textContent = res.error.message || "No se pudo enviar el enlace.";
              msg.style.display = "block";
              btn.disabled = false;
              return;
            }
            msg.className = "msg success";
            msg.textContent = "Listo. Revisa tu correo y abre el enlace para crear tu contraseña.";
            msg.style.display = "block";
          })
          .catch(function(err) {
            msg.className = "msg error";
            msg.textContent = err.message || "Error. Intenta de nuevo.";
            msg.style.display = "block";
            btn.disabled = false;
          });
      });
    })();
  </script>
</body>
</html>`;

module.exports = (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(getHtml(supabaseUrl, supabaseAnonKey));
};
