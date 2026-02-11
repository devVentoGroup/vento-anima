# Templates de Supabase y botones del login ANIMA

Guía de **qué template usa cada app**, **qué dejar bonito** y **qué hacer con los dos botones** del login.

---

## 1. Resumen: qué template usa quién

| Template en Supabase | Quién lo usa | Qué hacer |
|----------------------|--------------|-----------|
| **Magic Link** | **Vento Pass** (OTP / código de 6 dígitos) | Dejarlo **muy bien** para Vento Pass (marca, colores, texto claro). |
| **Reset password** | **ANIMA** (cuando el usuario toca «¿Olvidaste tu contraseña?») | Dejarlo **bien** para ANIMA (marca ANIMA, enlace a crear contraseña). |
| **Confirm sign up** | Opcional (si usas confirmación de correo al registrarse) | Si Pass lo usa al registrarse, estilo Vento Pass. Si no, mínimo. |
| **Invite user** | **No lo usamos** para trabajadores (enviamos correo con Resend) | Dejar texto genérico o mínimo; no hace falta invertir tiempo. |
| **Change email address** | Poco frecuente | Genérico o mismo estilo que Pass. |
| **Reauthentication** | Si lo usas en alguna app | Genérico. |
| **Notificaciones de seguridad** (password changed, email changed, etc.) | Si las tienes activadas | Genérico; una sola línea de “Vento” o “Soporte” basta. |

---

## 2. Dónde editarlos

**Supabase Dashboard** → **Authentication** → **Email Templates**.

Cada template tiene:
- **Subject** (asunto del correo)
- **Body** (HTML; puedes usar las variables que indica Supabase)

**Variables útiles (Go template):**
- `{{ .ConfirmationURL }}` — enlace que confirma (Magic Link, Reset, Invite, etc.)
- `{{ .Token }}` — código OTP de 6 dígitos (ideal para Vento Pass si envías código en vez de link)
- `{{ .Email }}` — correo del usuario
- `{{ .SiteURL }}` — URL del sitio configurada en el proyecto
- `{{ .RedirectTo }}` — URL a la que redirige tras confirmar (ej. anima.ventogroup.co para ANIMA)

---

## 3. Magic Link (Vento Pass) — dejarlo muy bien

**Uso:** Vento Pass. El usuario pone correo y recibe este correo (código OTP o enlace). Es el **único** correo de Supabase que ve el cliente de Pass.

**Asunto sugerido:**  
`Tu código de acceso a Vento Pass` (si usas OTP) o `Entra a Vento Pass` (si usas link).

**Cuerpo (ejemplo con código de 6 dígitos):**  
Si en Pass usas `{{ .Token }}` para que escriban el código en la app:

```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #1a1a1a; font-size: 1.5rem;">Vento Pass</h1>
  <p style="color: #333;">Tu código de acceso es:</p>
  <p style="font-size: 2rem; font-weight: 700; letter-spacing: 0.2em; color: #0d9488;">{{ .Token }}</p>
  <p style="color: #666; font-size: 0.9rem;">Introduce este código en la app. El código caduca en unos minutos.</p>
  <p style="color: #999; font-size: 0.8rem;">Si no solicitaste este correo, puedes ignorarlo.</p>
</div>
```

Si en Pass usas **enlace** en vez de código, sustituye el bloque del código por un botón con `{{ .ConfirmationURL }}` y texto tipo “Entrar en Vento Pass”. Ajusta colores/logo según tu marca Vento Pass.

---

## 4. Reset password (ANIMA) — para «¿Olvidaste tu contraseña?»

**Uso:** ANIMA. El usuario toca «¿Olvidaste tu contraseña?» en el login; Supabase envía este correo. El enlace debe llevar a **anima.ventogroup.co** (ya configurado con `redirectTo`).

**Asunto sugerido:**  
`Crear o restablecer contraseña – ANIMA`

**Cuerpo (ejemplo):**

```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #1a1a1a; font-size: 1.35rem;">ANIMA</h1>
  <p style="color: #333;">Alguien solicitó crear o restablecer la contraseña de tu cuenta. Haz clic en el enlace para continuar:</p>
  <p style="margin: 24px 0;">
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 24px; background: #e2006a; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600;">Crear / restablecer contraseña</a>
  </p>
  <p style="color: #666; font-size: 0.85rem;">Si no solicitaste esto, ignora este correo.</p>
</div>
```

Así el template de Supabase para “recuperar contraseña” queda alineado con ANIMA y con la página anima.ventogroup.co.

---

## 5. Invite user — no lo usamos para trabajadores

Los trabajadores reciben el correo que envía la Edge Function vía Resend (template en `staff-invitations-create`). El template **Invite user** de Supabase no se usa para ese flujo. Puedes dejarlo con un texto genérico por si en el futuro lo usas para otra cosa; no hace falta dedicarle diseño.

---

## 6. Botones del login de ANIMA

Hay dos botones debajo del formulario de login:

1. **«¿Olvidaste tu contraseña?»**  
   - **Sí se usa.** Envía el correo de Supabase “Reset password” y el enlace lleva a anima.ventogroup.co a crear/restablecer contraseña.  
   - **Qué hacer:** dejarlo tal cual. Solo asegura que el template **Reset password** en Supabase esté bien para ANIMA (sección 4).

2. **«Tengo una invitación»**  
   - Lleva a la pantalla `/invite` de la app.  
   - Con el flujo actual, la invitación se envía por correo con un **enlace a la web** (anima.ventogroup.co) para crear contraseña; no hace falta abrir la app para eso.  
   - **Opciones:**  
     - **Mantener el botón** y en la pantalla `/invite` dejar un texto claro: “Abre el enlace que te enviamos por correo para crear tu contraseña. Si no lo tienes, revisa tu bandeja o pide a tu administrador que te reenvíe la invitación.” Así quien entre por error al login sabe dónde ir.  
     - **O quitar el botón** si quieres un login más simple y que todo el flujo de invitación sea “solo por el correo”.

Recomendación: **mantener el botón** y mejorar el copy en `/invite` para que dirija a “abrir el enlace del correo”.

---

## 7. Checklist rápido

- [ ] **Magic Link** en Supabase → diseño claro para **Vento Pass** (código OTP o enlace, según uses).
- [ ] **Reset password** en Supabase → diseño para **ANIMA** y asunto “Crear o restablecer contraseña – ANIMA”.
- [ ] **Invite user** → genérico; no prioritario.
- [ ] Login ANIMA: «¿Olvidaste tu contraseña?» se queda; template Reset password = único que toca para ese flujo.
- [ ] Login ANIMA: «Tengo una invitación» → mantener y mejorar texto en `/invite` para que digan “abre el enlace del correo”.
