# ANIMA – Registro de contraseña por web (sin tocar la app)

Todo el flujo de **crear/restablecer contraseña** se hace en el navegador. **No hace falta cambiar código ni hacer builds de la app.** Solo despliegas esto en Vercel y compartes el enlace con los trabajadores.

## URLs que tendrás

Tras desplegar (ej. `https://anima-auth.vercel.app`):

- **Pedir enlace:** `https://tu-dominio.vercel.app/api/request-password` → el trabajador pone su correo y recibe el email.
- **Crear contraseña:** `https://tu-dominio.vercel.app/api/set-password` → Supabase redirige aquí cuando abren el enlace del correo; ponen y confirman la contraseña.

Comparte con tu hermana (o cualquier trabajador) el enlace de **request-password**. Ellos no tienen que abrir la app para nada.

## Desplegar en Vercel

1. Crea un proyecto en Vercel vinculado al repo **vento-anima**.
2. En **Settings → General → Root Directory** pon: `web-auth`.
3. En **Settings → Environment Variables** añade:
   - `SUPABASE_URL` = URL del proyecto Supabase (ej. `https://xxx.supabase.co`)
   - `SUPABASE_ANON_KEY` = clave anónima del proyecto (o `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
4. Despliega.

## Invitaciones desde ANIMA o Vento OS

La Edge Function `staff-invitations-create` envía el correo de invitación con marca ANIMA (vía Resend), no el de Supabase. Configura en **Supabase → Edge Functions → staff-invitations-create → Secrets**:

- `SET_PASSWORD_WEB_URL` = misma URL de set-password (ej. `https://tu-dominio.vercel.app/api/set-password`)
- `RESEND_API_KEY` = API key de [Resend](https://resend.com)
- `ANIMA_INVITE_FROM_EMAIL` (opcional) = remitente, ej. `ANIMA <noreply@tudominio.com>`

## Configurar Supabase

En **Authentication → URL Configuration → Redirect URLs** añade:

- `https://tu-dominio.vercel.app/api/set-password`  
  (el mismo dominio que uses en Vercel)

## Qué hace el trabajador (sin abrir la app)

1. Abre en el navegador el enlace que tú le pasas: **…/api/request-password**
2. Escribe su correo y pulsa «Enviar enlace».
3. Recibe el correo, abre el enlace → llega a **…/api/set-password**, escribe y confirma la contraseña.
4. Cierra la pestaña, abre la app ANIMA e inicia sesión con su correo y la contraseña que acaba de crear.

**No hace falta ningún build ni cambio en la app.** La app solo necesita que el trabajador tenga ya la contraseña creada (desde la web).
