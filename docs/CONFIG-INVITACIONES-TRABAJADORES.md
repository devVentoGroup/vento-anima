# Qué configurar para que las invitaciones de trabajadores funcionen

Lista mínima. Sin esto, invitar desde ANIMA o Vento OS no enviará el correo correcto o fallará.

---

## Checklist (marca lo que ya hiciste)

- [ ] **Supabase** – Redirect URL: `https://anima.ventogroup.co/api/set-password`
- [ ] **Supabase** – Secrets del proyecto (Edge Functions): `SET_PASSWORD_WEB_URL`, `RESEND_API_KEY`
- [ ] **Vercel** (proyecto anima) – Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- [ ] **Vento OS** (opcional) – Variable: `STAFF_INVITATIONS_CREATE_URL`

---

## 1. Supabase (proyecto que usa ANIMA y Vento Pass)

- **Authentication → URL Configuration → Redirect URLs**  
  Añade: `https://anima.ventogroup.co/api/set-password`  
  (anima.ventogroup.co)

- **Secrets del proyecto (para Edge Functions)**  
  En el Dashboard: **Edge Functions** (menú izquierdo) → pestaña **Secrets** (o **Manage secrets**). Los secrets son del **proyecto**, no de una función; la función `staff-invitations-create` los lee igual.  
  Añade:
  - `SET_PASSWORD_WEB_URL` = `https://anima.ventogroup.co/api/set-password`
  - `RESEND_API_KEY` = tu API key de [resend.com](https://resend.com)
  - `ANIMA_INVITE_FROM_EMAIL` (opcional) = ej. `ANIMA <noreply@ventogroup.co>`

  **Si en el Dashboard no ves Secrets:** usa la CLI (en la carpeta del proyecto con Supabase configurado):  
  `supabase secrets set SET_PASSWORD_WEB_URL=https://anima.ventogroup.co/api/set-password`  
  `supabase secrets set RESEND_API_KEY=re_xxxx`

- **Authentication → Email Templates**  
  Qué template usa cada app y cómo dejarlos bien: ver **[TEMPLATES-SUPABASE-Y-LOGIN-ANIMA.md](TEMPLATES-SUPABASE-Y-LOGIN-ANIMA.md)**. Resumen: **Magic Link** = Vento Pass (déjalo muy bien); **Reset password** = ANIMA (para «¿Olvidaste tu contraseña?»); **Invite** = no lo usamos para trabajadores.

---

## 2. Vercel (proyecto web-auth)

Proyecto: `clzdpinthhtknkmefsxx` → anima.ventogroup.co

- **Environment Variables** del proyecto:
  - `SUPABASE_URL` = URL del proyecto Supabase
  - `SUPABASE_ANON_KEY` = anon key del mismo proyecto

---

## 3. Vento OS (si quieres que use el mismo correo ANIMA que la app)

En el entorno donde corre Vento OS (Vercel, .env.local, etc.):

- `STAFF_INVITATIONS_CREATE_URL` = `https://TU-PROYECTO-SUPABASE.supabase.co/functions/v1/staff-invitations-create`  
  (mismo proyecto Supabase que ANIMA)

Si no pones esto, Vento OS seguirá enviando el correo de Supabase (invite por defecto) en lugar del correo ANIMA.

---

---

## Flujo real de invitación (paso a paso)

1. **En ANIMA (app móvil):** Propietario/Gerente entra a **Equipo** → **Invitar** → escribe correo, elige rol y sede → **Enviar invitación**.
2. **La app** llama a la Edge Function `staff-invitations-create` (Supabase) con ese correo, rol y sede.
3. **Si el correo es nuevo:**
   - Supabase genera un enlace de invitación que redirige a `https://anima.ventogroup.co/api/set-password`.
   - Se crea el usuario en Auth y la fila en `employees` / `employee_sites`.
   - Se envía **un solo correo** con Resend (template ANIMA) con el botón «Crear contraseña» que lleva a ese enlace.
4. **Si el correo ya existía** (ej. Vento Pass): no se envía correo; se le agrega a `employees`/`employee_sites`. En la app sale el mensaje de que le indiques que use «¿Olvidaste tu contraseña?» si solo entra con código.
5. **El invitado:** recibe el correo → abre el enlace (móvil o PC) → llega a **anima.ventogroup.co/api/set-password** → pone y confirma la contraseña → cierra la pestaña y abre ANIMA → inicia sesión con ese correo y la contraseña nueva.

No se usa el correo de Supabase para invitaciones de trabajadores; solo el de Resend con el template que está en el código de la función.

---

## Template del correo de invitación

El HTML del correo está **en el código** de la Edge Function, no en el Dashboard de Resend.

- **Archivo:** `vento-anima/supabase/functions/staff-invitations-create/index.ts`  
- **Busca el bloque** que empieza con `const html = \`<!DOCTYPE html>` (aprox. línea 375). Ahí está el asunto, el texto y el botón.

**Qué puedes cambiar sin tocar lógica:**  
- El texto dentro del HTML (títulos, párrafos).  
- Los estilos `style="..."` (colores, tamaños).  
- El **asunto** del correo: en el mismo archivo, `subject: "Invitación a ANIMA – Crear contraseña"` (aprox. línea 387).

**No cambies:** la variable `${actionLink}` (es el enlace que lleva a crear contraseña).  
Después de editar, hay que **volver a desplegar** la función en Supabase (`supabase functions deploy staff-invitations-create`).

---

## Cómo comprobar que el flujo quedó bien

Haz esta prueba **una vez** después de configurar todo:

1. En la app ANIMA, entra con un usuario que pueda invitar (propietario o gerente).
2. Ve a **Equipo** → **Invitar**.
3. Pon un **correo de prueba** (uno al que tengas acceso), rol y sede → **Enviar invitación**.
4. Debe salir en la app algo como «Invitación enviada» / «Correo enviado a …».
5. Revisa la **bandeja de entrada** (y spam) de ese correo: debe llegar **un solo correo** con asunto «Invitación a ANIMA – Crear contraseña» y un botón «Crear contraseña».
6. **Abre el enlace** (en el móvil o en el navegador): debe cargar la página de anima.ventogroup.co para crear contraseña (formulario con «Nueva contraseña» y «Confirmar contraseña»).
7. Pon una contraseña (mín. 8 caracteres) y guarda.
8. Debe salir «Listo» y decir que puedes cerrar e iniciar sesión en ANIMA.
9. Abre ANIMA e **inicia sesión** con ese correo y la contraseña que acabas de crear. Debe entrar bien.

Si **algo falla:**  
- No llega el correo → revisa Resend (Dashboard → Logs) y que `RESEND_API_KEY` y `SET_PASSWORD_WEB_URL` estén en Secrets de Supabase.  
- El enlace no abre la página de crear contraseña → revisa que la Redirect URL en Supabase sea exactamente `https://anima.ventogroup.co/api/set-password` y que en Vercel (anima) tengas `SUPABASE_URL` y `SUPABASE_ANON_KEY`.  
- La app dice «No se pudo crear la invitación» → mira el mensaje de error; suele ser falta de un secret o URL mal puesta.

---

## Resumen en una línea

**Supabase:** redirect URL + secrets (SET_PASSWORD_WEB_URL, RESEND_API_KEY). **Vercel (anima):** SUPABASE_URL, SUPABASE_ANON_KEY. **Template:** en `staff-invitations-create/index.ts`. **Probar:** invitar con un correo de prueba → recibir correo → abrir enlace → crear contraseña → entrar en ANIMA.
