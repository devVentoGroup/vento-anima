# Cuenta demo para revisión de Apple (Guideline 2.1)

Apple exige una cuenta de prueba que permita acceder a **todas** las funcionalidades de la app. Este documento asegura que la cuenta funcione de forma fiable.

---

## 1. Qué poner en App Store Connect

En **App Store Connect** → tu app **ANIMA** → **Información de la app** → **Información de la revisión de la app (beta)** (o "App Review Information" / "Beta App Review Information"):

| Campo     | Valor                  |
|----------|-------------------------|
| **Usuario** | `test@ventogroup.com` |
| **Contraseña** | `TestPass123`     |

- Escribe exactamente así (minúsculas, sin espacios).
- La app usa esta misma contraseña internamente cuando el revisor escribe ese email, así que aunque Apple copie mal la contraseña, el login seguirá funcionando.

---

## 2. Verificar la cuenta en Supabase

La cuenta debe existir en **Supabase Auth** y tener datos en **employees** y **employee_sites**. Si no, tras el login la app quedará vacía y Apple rechazará.

### 2.1 Usuario en Auth

1. Supabase Dashboard → **Authentication** → **Users**.
2. Debe existir un usuario con email **test@ventogroup.com**.
3. Si no existe:
   - **Add user** → **Create new user**
   - Email: `test@ventogroup.com`
   - Password: `TestPass123`
   - Marcar **Auto Confirm User**.
   - Crear.

4. Si ya existe pero no recuerdas la contraseña: **Edit user** y cambia la contraseña a `TestPass123`.

### 2.2 Datos de empleado y sitios

Tras tener el usuario en Auth, hay que crear su fila en `employees` y en `employee_sites` para que la app muestre Home, check-in, documentos, etc.

1. En Supabase → **SQL Editor**, ejecuta el script:
   - `vento-anima/supabase/sql/2026-01-28_create_test_account.sql`
2. Ese script:
   - Busca un sitio activo (p. ej. "Vento Group").
   - Crea/actualiza la fila en `employees` para el usuario `test@ventogroup.com`.
   - Crea/actualiza la fila en `employee_sites` para que tenga al menos un sitio asignado.

Si el script falla con "Usuario no encontrado", crea primero el usuario en Auth (paso 2.1) y vuelve a ejecutarlo.

### 2.3 Sede para check-in desde cualquier lugar (revisores fuera de Cúcuta)

Los revisores de Apple/Google suelen estar en otro país, así que no pueden estar dentro del radio de tus sedes físicas. Para que puedan probar check-in y check-out **sin hacer otro build**:

1. En Supabase → **SQL Editor**, ejecuta:
   - `vento-anima/supabase/sql/2026-02-04_site_review_demo.sql`
2. Ese script:
   - Crea una sede **"App Review (Demo)"** sin coordenadas y con `type = 'vento_group'`.
   - La app la trata como "Esta sede no requiere GPS" y permite check-in desde cualquier ubicación.
   - El trigger del backend también ignora la validación de distancia para ese tipo de sede.
   - Asigna **solo** esa sede a la cuenta `test@ventogroup.com` (quita las sedes de Cúcuta para ese usuario).

Así la cuenta de revisión puede hacer check-in y check-out desde cualquier parte del mundo. No hace falta tocar código ni generar un nuevo build.

---

## 3. Build de producción (EAS)

Las variables de revisión deben estar en el build que envías a Apple:

- En **eas.json** el perfil `production` ya incluye:
  - `EXPO_PUBLIC_REVIEW_EMAILS=test@ventogroup.com`
  - `EXPO_PUBLIC_REVIEW_PASSWORD=TestPass123`
- Así, al hacer login con `test@ventogroup.com`, la app usará siempre `TestPass123` aunque el revisor escriba otra cosa en el campo contraseña.

Si prefieres no tener la contraseña en el repo, puedes definir **EAS Secrets** con los mismos nombres; EAS los inyectará en el build y sobrescribirán los de `eas.json`.

---

## 4. Checklist antes de enviar a revisión

- [ ] En App Store Connect: Usuario `test@ventogroup.com`, Contraseña `TestPass123`.
- [ ] En Supabase Auth: existe el usuario `test@ventogroup.com` con contraseña `TestPass123` y está confirmado.
- [ ] Ejecutado `2026-01-28_create_test_account.sql` (existe fila en `employees` y `employee_sites` para ese usuario).
- [ ] Build de producción generado con las env de revisión (eas.json o EAS Secrets).
- [ ] Probado localmente: login con `test@ventogroup.com` / `TestPass123`, entrar a Home, check-in, documentos, soporte, etc.

---

## 5. Si Apple sigue sin poder acceder

En la respuesta a Apple (Resolution Center), puedes incluir algo como:

> The demo account is:
> Username: test@ventogroup.com  
> Password: TestPass123  
>
> Please enter the username exactly as above (all lowercase). The app will accept this password for the review account. If you still cannot log in, please confirm you are using a stable internet connection and the latest build; we have verified this account successfully on our side.

Y comprobar de nuevo en Supabase que el usuario existe, está confirmado, y que el script SQL de la cuenta de prueba se ha ejecutado sin errores.

---

## 6. Por qué Apple sigue rechazando (y qué hacer)

Si ya tienes la cuenta en Auth, en employees, en employee_sites y las credenciales en App Store Connect, las causas más probables son:

### 6.1 Build antiguo (la más común)

Si el build que Apple está probando se generó **antes** de añadir la lógica de “contraseña de revisión automática” y las env en `eas.json`, el login sigue dependiendo de que copien la contraseña exacta. Cualquier error al copiar (espacio, carácter raro) hace que falle.

**Qué hacer:**
1. Genera un **nuevo build de producción** con EAS (asegurándote de que el código actual con la contraseña de revisión y las env está en el build).
2. Súbelo a App Store Connect y **envía de nuevo a revisión** con ese build.
3. En el Resolution Center escribe que han de usar **el último build** y que la app ya está actualizada para que la cuenta demo funcione correctamente.

### 6.2 RLS (Row Level Security) en Supabase

Si en las tablas `employees` y `employee_sites` está activado RLS y no hay una política que permita al usuario autenticado leer **su propia fila**, la app hace login pero obtiene vacío y la pantalla queda incompleta. En el Dashboard ves los datos porque entras como admin; la app usa el JWT del usuario y puede estar siendo bloqueada.

**Qué hacer:**
1. Supabase → **Table Editor** → tabla `employees` → pestaña **Policies**.
2. Debe haber una política tipo “Users can read their own row” con condición `id = auth.uid()` (o equivalente) para `SELECT`. Si no existe, créala.
3. Igual en `employee_sites`: política que permita `SELECT` donde `employee_id = auth.uid()`.

Sin estas políticas, el usuario de revisión no verá su empleado ni sus sitios aunque las filas existan.

### 6.3 Contraseña en Auth no coincide

La contraseña guardada en Supabase Auth para `test@ventogroup.com` puede haberse cambiado en algún momento y no ser exactamente `TestPass123`.

**Qué hacer:**
1. Supabase → **Authentication** → **Users** → usuario `test@ventogroup.com`.
2. **Edit user** → en **Password** pon exactamente `TestPass123` (T y P mayúsculas, sin espacios).
3. Guarda y vuelve a probar el login en la app.

### 6.4 Mensaje genérico de Apple

A veces Apple envía “we were unable to successfully access your app” por otros motivos (crash, pantalla en blanco, o que no probaron el último build). No siempre es un fallo de login.

**Qué hacer:**
Responde en el **Resolution Center** pidiendo detalles concretos y usando el texto de la sección 7 (en inglés). Así sabrás si el problema es login, pantalla en blanco o crash, y podrás corregirlo.

---

## 7. Mensaje para pegar en el Resolution Center (inglés)

Copia y pega esto (o adapta) al responder a Apple:

```
Thank you for your feedback.

We have updated the app and the demo account so that reviewers can access all features reliably. Please use the LATEST build when testing.

Demo account (please use exactly as shown):
• Username: test@ventogroup.com (all lowercase, no spaces)
• Password: TestPass123 (capital T and P, no spaces)

Steps:
1. Open the app and wait for the login screen.
2. Enter the username above in the email field.
3. Enter the password above in the password field.
4. Tap "Iniciar Sesión" (Sign In).
5. You should see the main screen with Check-in, History, Documents, Support, and News.

If you still cannot log in or see a blank screen after login, please tell us exactly what you see (e.g. error message, blank screen, crash) and confirm you are testing the latest build. We have verified this account works on our side with the current build.

Thank you.
```
