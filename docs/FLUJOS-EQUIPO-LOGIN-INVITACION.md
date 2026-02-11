# Flujos: Equipo, login, invitación y registro

## Correos de Supabase (solo clientes – Vento Pass)

- **Vento Pass no usa contraseña:** solo OTP (correo + código de 6 dígitos → sesión persistente). No usa set-password ni recovery.
- En este proyecto, el **único** correo de Supabase que importa para clientes es el del **código OTP**. En **Authentication → Email Templates** personaliza solo la plantilla **OTP / Magic Link** con marca Vento Pass / Vento OS.
- Para **trabajadores** (ANIMA / Vento OS) no se usa el correo de invitación de Supabase; se envía un correo propio con marca ANIMA y enlace a la web de crear contraseña (ver más abajo).

### Redirect URL en Supabase (trabajadores)

- En **Authentication → URL Configuration → Redirect URLs** añade la URL de la página web donde los trabajadores crean contraseña, por ejemplo:  
  `https://tu-dominio.vercel.app/api/set-password`  
  (mismo dominio que uses en Vercel para [web-auth](vento-anima/web-auth)).

---

## Qué pasa cuando invitas a un trabajador

### Caso A – El correo **no** está registrado (nuevo)
1. Se crea el usuario en Auth (Supabase) y **se envía un correo** con un enlace.
2. La persona abre el enlace en el dispositivo donde tiene ANIMA (o lo instala), entra a la pantalla "Completa tu cuenta".
3. Completa nombre, contraseña y acepta → se llama a `staff-invitations-accept` → se crean/actualizan `employees` y `employee_sites`.
4. Ya puede usar ANIMA con ese correo y contraseña.

### Caso B – El correo **ya** está registrado (ej. Vento Pass)
1. **No se envía correo.** La Edge Function detecta que el usuario existe en Auth.
2. Se agrega directamente a `employees` y `employee_sites` con el rol y sede elegidos.
3. La persona puede entrar a ANIMA:
   - Si **ya tiene contraseña** (ej. la creó en otra app o en el formulario de invitación): inicia sesión con correo y contraseña.
   - Si **solo entró con código OTP** (ej. en Vento Pass, que usa código por correo y no pide contraseña): no tiene contraseña. Debe usar **«¿Olvidaste tu contraseña?»** en el login de ANIMA; recibe un correo, abre el enlace en el dispositivo y crea una contraseña. Luego ya puede entrar con correo y contraseña.

Por eso tu hermana quedó en Equipo pero no necesariamente recibió un correo: si ya tenía cuenta (Vento Pass), solo se la agregó al equipo. Si en Vento Pass solo usa código, en ANIMA debe crear contraseña con «¿Olvidaste tu contraseña?». El mensaje de éxito en Equipo se muestra a quien invita (admin) e indica que le diga al trabajador que use «¿Olvidaste tu contraseña?» si aplica.

---

## Login
- Validación de correo (formato).
- Mensajes claros: credenciales incorrectas, sin conexión, error genérico.
- **¿Olvidaste tu contraseña?** → envía un correo con enlace para crear/restablecer contraseña. El enlace abre la app en `/invite` con `type=recovery`; la pantalla muestra solo "Crear contraseña" (sin nombre/alias) y al guardar se actualiza la contraseña y se redirige a home. Necesario para quienes solo tienen cuenta OTP (ej. Vento Pass).
- Cuenta de revisión (Apple/Google): si el email está en `EXPO_PUBLIC_REVIEW_EMAILS`, se usa la contraseña de demo.
- Enlace "Tengo una invitación" → lleva a `/invite` (sirve si abrieron el correo en otro dispositivo y quieren completar en este).

---

## Formulario de aceptación de invitación y crear contraseña (`/invite`)
- **Invitación (enlace de invitación):** obligatorios nombre completo, contraseña (mín. 8), confirmar contraseña. Opcional: alias. Se llama a `staff-invitations-accept`. Al activar → redirección a `/home`.
- **Crear contraseña (enlace «¿Olvidaste tu contraseña?»):** la URL incluye `type=recovery`. Se muestra solo contraseña y confirmar; no se pide nombre/alias. Al enviar se llama a `supabase.auth.updateUser({ password })` y redirección a `/home`. Sirve para quienes tienen cuenta pero no contraseña (ej. solo OTP en Vento Pass).
- Si la función o el servidor devuelve error, se muestra en un Alert.

---

## Edición de trabajadores (Equipo)
- Editar nombre, alias, rol, sede principal, sedes asignadas, activo/inactivo.
- Validaciones: nombre, rol, permisos según quien edita (propietario/gerente general/gerente).
- Al guardar se actualizan `employees` y `employee_sites` y se cierra el modal.

---

## Posible mejora futura: Reenviar invitación
- Hoy **no** hay lista de "invitaciones pendientes" (personas a las que se les envió correo pero aún no aceptaron). En Equipo solo se listan quienes ya están en `employees`.
- Para añadir "Reenviar invitación" haría falta:
  - Identificar usuarios en Auth que fueron invitados (metadata) y que **no** tienen fila en `employees`, y/o
  - Una tabla tipo `staff_invitations` (email, rol, site_id, invited_at, status) para mostrar pendientes en la UI.
- Supabase no expone un "resend invite" directo; se podría generar un nuevo enlace mágico y enviarlo por correo (Edge Function + servicio de email).
- Mientras tanto: si alguien no recibió el correo, se puede decir que revise spam o que intenten invitarla de nuevo (si aún no aceptó, volver a invitar puede fallar por "user already exists"; en ese caso el flujo "agregar al equipo" actual no aplica porque el usuario invitado aún no está en `employees` — habría que implementar el reenvío de enlace).

---

## Cómo comprobar el flujo de trabajadores (sin depender del celular)

Puedes validar todo desde Vento OS (web) o desde ANIMA (app) sin necesidad de instalar la app en varios dispositivos:

1. **Desde Vento OS (web):** Crear un trabajador con un correo de prueba (o usar Mailtrap para ver el correo).
2. Comprobar que llega **un solo** correo, con marca ANIMA y asunto tipo «Invitación a ANIMA – Crear contraseña».
3. Abrir el enlace del correo en el navegador (móvil o PC) y completar «Crear contraseña» en la página web (set-password).
4. Cerrar la pestaña e iniciar sesión en Vento OS (o en ANIMA cuando esté instalada) con ese correo y la contraseña nueva.
5. Opcional: repetir con «agregar al equipo» (correo que ya existía en Auth, ej. Vento Pass) y verificar el mensaje de éxito y que se le indique usar «¿Olvidaste tu contraseña?» si aplica.

Con esto puedes validar el flujo completo en escritorio y usar Vento OS para dar de alta trabajadores aunque ANIMA siga en revisión.
