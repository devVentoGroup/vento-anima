# Guía completa: Carnet laboral en Wallet (ANIMA)

Esta guía explica **paso a paso** cómo configurar todo lo que falta para que el carnet laboral funcione en ANIMA (Google Wallet en Android y Apple Wallet en iOS). Sigue los pasos en orden.

---

## Índice

1. [Qué vamos a configurar](#1-qué-vamos-a-configurar)
2. [Requisitos previos](#2-requisitos-previos)
3. [Paso 1: Base de datos en Supabase (ANIMA)](#3-paso-1-base-de-datos-en-supabase-anima)
4. [Paso 2: Certificados Apple para el pase](#4-paso-2-certificados-apple-para-el-pase)
5. [Paso 3: Google Wallet (Android) en Supabase](#5-paso-3-google-wallet-android-en-supabase)
6. [Paso 4: Edge Function employee-wallet-pass en Supabase](#6-paso-4-edge-function-employee-wallet-pass-en-supabase)
7. [Paso 5: API de Apple Pass (employee-wallet-api) en Vercel](#7-paso-5-api-de-apple-pass-employee-wallet-api-en-vercel)
8. [Paso 6: Variables de entorno en la app ANIMA](#8-paso-6-variables-de-entorno-en-la-app-anima)
9. [Paso 7 (opcional): Revocación automática con cron](#9-paso-7-opcional-revocación-automática-con-cron)
10. [Verificación y pruebas](#10-verificación-y-pruebas)
11. [Problemas frecuentes](#11-problemas-frecuentes)

---

## 1. Qué vamos a configurar

| Componente | Dónde | Para qué |
|------------|--------|----------|
| **Supabase (ANIMA)** | Proyecto Supabase de ANIMA | Migraciones ya aplicadas (document_types, required_document_rules, employee_wallet_cards, RPCs). Solo hay que asegurar que estén aplicadas. |
| **Certificados Apple** | Apple Developer + archivos .p12 / WWDR | Firmar el .pkpass para Apple Wallet. |
| **Supabase – Secrets** | Dashboard → Project Settings → Edge Functions | Para la función `employee-wallet-pass`: Google Wallet (issuer, class, service account). |
| **employee-wallet-api** | Vercel (carpeta `employee-wallet-api` del repo ANIMA) | Servir el archivo .pkpass para iOS. |
| **App ANIMA** | `.env` o EAS / app.config | `EXPO_PUBLIC_SUPABASE_URL` y, para iOS, `EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE`. |

---

## 2. Requisitos previos

- **Cuenta Apple Developer** (Team ID, capacidad de crear Pass Type IDs y certificados para Wallet).
- **Cuenta Google Pay & Wallet** (Google Cloud) para la clase de pase de empleado.
- **Proyecto Supabase** de ANIMA ya creado y enlazado a la app.
- **Repositorio vento-anima** con la carpeta `employee-wallet-api` y las migraciones en `supabase/migrations/`.
- **Cuenta Vercel** para desplegar la API de Apple Pass.

---

## 3. Paso 1: Base de datos en Supabase (ANIMA)

### 3.1 Comprobar que las migraciones están aplicadas

En el proyecto Supabase de ANIMA (Dashboard → **SQL Editor** o **Migrations**):

1. Verifica que existan estas migraciones (por nombre o por objetos creados):
   - `document_types` con columna `system_key` y al menos un registro con `system_key = 'employment_contract'`.
   - Tabla `required_document_rules`.
   - Tabla `employee_wallet_cards`.
   - Función `employee_wallet_eligibility(p_employee_id uuid)`.
   - Función `employee_wallet_mark_issued(p_employee_id uuid)`.
   - Función `employee_wallet_sync_eligibility()` (para el cron de revocación).

2. Si falta alguna, aplica las migraciones desde el repo:
   - En tu máquina: `cd vento-anima && npx supabase db push` (o el comando que uses para aplicar migraciones al proyecto remoto).
   - O copia y ejecuta manualmente el SQL de cada archivo en `supabase/migrations/` que empiece por `20260315` (employee wallet).

### 3.2 Tipo de documento "Contrato laboral"

1. Ve a **Table Editor** → tabla **`document_types`**.
2. Localiza o crea una fila con:
   - **system_key** = `employment_contract`
   - **name** = `Contrato laboral` (o el nombre que uses en VISO).
3. Anota el **id** (UUID) de ese tipo; lo usarás en VISO para subir contratos.

### 3.3 Reglas de documentos requeridos (opcional pero recomendado)

En **VISO** → negocio/sede → sección "Documentos requeridos y carnet laboral":

1. Añade una regla que requiera el tipo **Contrato laboral** para la sede (y rol si aplica).
2. Añade otras reglas si quieres exigir más documentos (cédula, etc.) para que el empleado sea elegible.

Sin reglas requeridas, la RPC considera "documentos completos"; con reglas, el empleado debe tener cada tipo cargado y aprobado.

---

## 4. Paso 2: Certificados Apple para el pase

El .pkpass se firma con un certificado Apple. Necesitas un **Pass Type ID** y un **certificado (.p12)** asociado, más el **WWDR** de Apple.

### 4.0 Reutilizar el certificado de vento-pass (recomendado)

Si ya tienes el pase de **loyalty** de vento-pass en Apple Wallet (desplegado en pass.ventogroup.co / wallet-pass-api), **puedes usar el mismo certificado y Pass Type ID** para el carnet laboral de ANIMA.

- **Mismo Pass Type ID** → mismo .p12 y misma WWDR. Solo cambia el contenido del pase (loyalty vs empleado); la firma es la misma.
- En **employee-wallet-api** (Vercel), configura las mismas variables de Apple que en el proyecto de vento-pass:
  - `APPLE_PASS_P12_BASE64`
  - `APPLE_PASS_P12_PASSWORD`
  - `APPLE_WWDR_PEM_BASE64`
  - `APPLE_PASS_TYPE_ID`
  - `APPLE_TEAM_ID`
  - `APPLE_PASS_LOGO_URL` (y, si lo usas, `APPLE_PASS_ICON_URL`)

Puedes copiarlas desde el proyecto Vercel de vento-pass (o desde donde tengas el wallet-pass-api) y pegarlas en el proyecto Vercel de **employee-wallet-api**. No hace falta crear un Pass Type ID nuevo ni exportar de nuevo el .p12.

Si prefieres un Pass Type ID distinto para el carnet (p. ej. para separar en Apple o en informes), entonces sí tendrías que crear uno nuevo y seguir los apartados 4.1–4.4.

### 4.1 Crear Pass Type ID (solo si no reutilizas el de pass)

1. Entra en [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**.
2. **Identifiers** → **+** → **Pass Type IDs**.
3. Descripción: p. ej. "ANIMA Carnet laboral".
4. Identifier: p. ej. `pass.co.ventogroup.anima` (debe ser único y reverse-DNS).
5. Crea y anota el **Pass Type ID** y el **Team ID** (en la esquina superior derecha o en Membership).

### 4.2 Crear certificado para el Pass Type ID (solo si no reutilizas)

1. En **Identifiers** → tu Pass Type ID → **Create Certificate**.
2. Sigue el asistente (crear CSR en tu Mac con Acceso a Llaveros, subir CSR, descargar el .cer).
3. En tu Mac: abre el .cer (doble clic) para instalarlo en el llavero. Luego en **Acceso a Llaveros**:
   - Busca el certificado recién instalado (nombre del Pass Type ID).
   - Clic derecho → **Exportar** → guardar como **.p12**.
   - Define una **contraseña** para el .p12 y guárdala (la usarás como `APPLE_PASS_P12_PASSWORD`).

### 4.3 Descargar WWDR (solo si no reutilizas; si reutilizas, ya lo tienes)

1. En [Apple PKI](https://www.apple.com/certificateauthority/) descarga **Apple Worldwide Developer Relations - G4 (Expiring 12/10/2030)** o el vigente.
2. Ábrelo en Mac y en Acceso a Llaveros exporta como **PEM** (o usa en terminal):
   ```bash
   openssl x509 -in AppleWWDRCAG4.cer -inform DER -out AppleWWDRCAG4.pem -outform PEM
   ```

### 4.4 Convertir a base64 para variables de entorno

En tu máquina (PowerShell o terminal):

**P12 (certificado + clave privada):**
```powershell
# PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ruta/al/archivo.p12"))
```
```bash
# Bash / Mac
base64 -i archivo.p12 | tr -d '\n' > p12_base64.txt
```
Copia el resultado (una línea larga). Será el valor de **APPLE_PASS_P12_BASE64**.

**WWDR (PEM):**
```powershell
# PowerShell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content "ruta/AppleWWDRCAG4.pem" -Raw)))
```
```bash
# Bash / Mac
base64 -i AppleWWDRCAG4.pem | tr -d '\n' > wwdr_base64.txt
```
Copia el resultado. Será **APPLE_WWDR_PEM_BASE64**.

Guarda estos dos valores y la contraseña del .p12; los usarás en el **Paso 7** (employee-wallet-api en Vercel).

### 4.5 Logo e icono del pase

Necesitas URLs públicas (HTTPS) para:

- **Logo**: imagen del logo que aparecerá en el pase (recomendado PNG, fondo transparente o blanco).
- **Icono**: icono pequeño (por defecto puede ser la misma URL que el logo).

Puedes subir las imágenes a Supabase Storage (bucket público) o a cualquier CDN y anotar las URLs. Ejemplo:
- `APPLE_PASS_LOGO_URL` = `https://xxx.supabase.co/storage/v1/object/public/bucket/logo-pass.png`
- `APPLE_PASS_ICON_URL` = misma URL o otra para el icono.

---

## 5. Paso 3: Google Wallet (Android) en Supabase

Para que la Edge Function `employee-wallet-pass` genere el enlace de Google Wallet necesitas una **clase de pase genérico** de empleado en Google Pay & Wallet.

### 5.1 Google Cloud / Pay & Wallet

1. Entra en [Google Pay & Wallet Console](https://pay.google.com/business/console) (o Google Cloud del proyecto que uses para Wallet).
2. Crea o selecciona un **Issuer** (emisor).
3. Crea una **clase** de tipo **Generic** (tarjeta genérica) para el carnet laboral, por ejemplo:
   - Nombre: "Carnet laboral"
   - Id de clase: algo como `empleado_anima` (anota el **Class ID** completo, suele ser `issuerId.classId`).
4. Anota el **Issuer ID** y el **Class ID** (solo la parte de la clase, sin el issuer).

### 5.2 Cuenta de servicio

1. En Google Cloud Console → **IAM & Admin** → **Service Accounts** → crea una cuenta de servicio para Wallet.
2. Descarga la **clave JSON** de la cuenta de servicio.
3. En la consola de Google Wallet, asocia esta cuenta de servicio al Issuer (permisos para crear objetos).
4. Abre el JSON descargado y copia **todo su contenido** (será el valor de **GOOGLE_WALLET_SERVICE_ACCOUNT_JSON** en Supabase). No lo compartas ni lo subas a repos públicos.

---

## 6. Paso 4: Edge Function employee-wallet-pass en Supabase

La función que genera el **saveUrl** de Google Wallet vive en Supabase (ANIMA) y usa secrets.

### 6.1 Desplegar la función

Desde el repo vento-anima:

```bash
cd vento-anima
npx supabase functions deploy employee-wallet-pass --project-ref TU_REF_DE_PROYECTO
```

(Sustituye `TU_REF_DE_PROYECTO` por el ref del proyecto en la URL del Dashboard: `https://app.supabase.com/project/TU_REF`.)

### 6.2 Configurar secrets de la función

En Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets** (o **Settings** → **Edge Functions** → **Manage secrets**), añade:

| Secret | Valor | Descripción |
|--------|--------|-------------|
| `GOOGLE_WALLET_ISSUER_ID` | Tu Issuer ID de Google | Ej. `3388000000022345678` |
| `GOOGLE_WALLET_EMPLOYEE_CLASS_ID` | Class ID de la clase Generic de empleado | Solo la parte de la clase (ej. `empleado_anima`). La función construye `issuerId.employeeClassId`. |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | Contenido completo del JSON de la cuenta de servicio | Pegar el JSON entero (una línea o multilínea según permita la UI). |

No hace falta poner `SUPABASE_URL` ni `SUPABASE_ANON_KEY`; Supabase los inyecta por defecto.

### 6.3 Probar (opcional)

Con un token de un usuario ANIMA que sea empleado elegible:

```bash
curl -X POST "https://TU_REF.supabase.co/functions/v1/employee-wallet-pass" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}"
```

La respuesta debe ser JSON con `saveUrl`. Si hay error 500, revisa los secrets y los logs de la función en el Dashboard.

---

## 7. Paso 5: API de Apple Pass (employee-wallet-api) en Vercel

Esta API sirve el archivo **.pkpass** para iOS. Se despliega en Vercel desde la carpeta `employee-wallet-api` del repo vento-anima.

### 7.1 Preparar el proyecto en Vercel

1. Entra en [Vercel](https://vercel.com) y en **Add New** → **Project**.
2. Importa el repositorio que contiene **vento-anima** (o el repo donde esté la carpeta `employee-wallet-api`).
3. En **Configure Project**:
   - **Root Directory**: haz clic en **Edit** y elige **solo** la carpeta `employee-wallet-api` (así el root del deploy es esa carpeta y Vercel detecta `api/` como serverless functions).
   - Framework Preset: **Other** (o **Vercel** si lo detecta).
   - Build Command: puede quedar vacío si no hay build.
   - Output Directory: vacío.
4. **Deploy** una primera vez (puede fallar si faltan env; sigue al siguiente paso).

### 7.2 Variables de entorno en Vercel

En el proyecto Vercel → **Settings** → **Environment Variables**, añade estas variables para **Production** (y si quieres también Preview):

| Variable | Valor | Notas |
|----------|--------|--------|
| `SUPABASE_URL` | `https://TU_REF.supabase.co` | URL del proyecto Supabase de ANIMA. |
| `SUPABASE_ANON_KEY` | Clave anon pública del proyecto | Dashboard → Settings → API. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service_role | La misma sección; **no** expongas esta clave en la app. |
| `APPLE_PASS_P12_BASE64` | Cadena base64 del .p12 | La que generaste en el Paso 4.4. |
| `APPLE_PASS_P12_PASSWORD` | Contraseña del .p12 | La que definiste al exportar. |
| `APPLE_WWDR_PEM_BASE64` | Cadena base64 del PEM del WWDR | La que generaste en el Paso 4.4. |
| `APPLE_PASS_TYPE_ID` | Pass Type ID completo | Ej. `pass.co.ventogroup.anima`. |
| `APPLE_TEAM_ID` | Team ID de Apple | Ej. `ABCD1234EF`. |
| `APPLE_PASS_LOGO_URL` | URL HTTPS del logo | Ej. `https://xxx.supabase.co/storage/.../logo.png`. |
| `APPLE_PASS_ICON_URL` | URL del icono | Opcional; si no, se usa el logo. |

Opcionales:

- `APPLE_EMPLOYEE_PASS_TYPE_ID`: si quieres un Pass Type ID distinto solo para este pase.
- `APPLE_EMPLOYEE_ORG_NAME`: texto "Vento" o el nombre que quieras en el pase.
- `APPLE_EMPLOYEE_PASS_DESCRIPTION`: descripción del pase (ej. "Carnet laboral").
- `PASS_WEB_SERVICE_URL`: solo si más adelante implementas actualizaciones del pase vía web service.

Guarda y **redeploy** el proyecto para que las variables se apliquen.

### 7.3 URL final de la API

Tras el deploy, la URL del proyecto será algo como:

`https://employee-wallet-api-xxx.vercel.app`

El endpoint del pase es:

`https://employee-wallet-api-xxx.vercel.app/api/employee-apple-pass?token=ACCESS_TOKEN`

Anota la **URL base** (sin `/api/...`); la usarás en el Paso 8 como **EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE**.

### 7.4 Probar el endpoint (opcional)

Con un token de sesión de un empleado elegible (desde la app o desde Supabase Auth):

Abre en el navegador (o con curl):

`https://TU_PROYECTO_VERCEL.vercel.app/api/employee-apple-pass?token=TU_ACCESS_TOKEN`

Debe descargarse un archivo **.pkpass**. Si recibes 401/403/500, revisa token, elegibilidad del empleado y variables de entorno (sobre todo certificados y Pass Type ID).

---

## 8. Paso 6: Variables de entorno en la app ANIMA

La app ANIMA debe conocer la URL de Supabase y, para iOS, la URL base de la API de Apple Pass.

### 8.1 Dónde configurarlas

- Si usas **EAS / Expo** y builds en la nube: en [Expo Dashboard](https://expo.dev) → tu proyecto → **Environment variables** (o en `eas.json` con `env`), define las variables para cada perfil (development, preview, production).
- Si usas **.env** local (y lo cargas con `expo-env` o similar): crea o edita `.env` en la raíz del proyecto **vento-anima** (no dentro de `employee-wallet-api`).

### 8.2 Variables obligatorias

| Variable | Valor | Uso |
|----------|--------|-----|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://TU_REF.supabase.co` | Llamadas a Supabase y a la Edge Function de Google Wallet. |

(Si ya tienes la app conectada a Supabase, esta variable ya debería estar.)

### 8.3 Variable para Apple Wallet (iOS)

| Variable | Valor | Uso |
|----------|--------|-----|
| `EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE` | `https://employee-wallet-api-xxx.vercel.app` | URL base del proyecto Vercel del Paso 7 (sin barra final). La app construye `/api/employee-apple-pass?token=...`. |

Si **no** defines esta variable, la app usará por defecto la Edge Function de Supabase `employee-apple-pass`, que devuelve 501 (no implementado); en ese caso el botón "Agregar a Wallet" en iOS no descargará un .pkpass hasta que configures esta URL.

### 8.4 Ejemplo .env (raíz de vento-anima)

```env
EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE=https://anima-employee-wallet.vercel.app
```

No subas `.env` con claves secretas a Git; usa `.gitignore` y en producción EAS/Expo.

### 8.5 Rebuild de la app

Las variables que empiezan por `EXPO_PUBLIC_` se embeben en el build. Después de añadir o cambiar cualquiera de ellas:

- Desarrollo local: reinicia el bundler (y si hace falta borra caché: `npx expo start -c`).
- Build de producción: genera un nuevo build (EAS Build o el método que uses) para que el nuevo valor se incluya.

---

## 9. Paso 7 (opcional): Revocación automática con cron

Para que los carnets emitidos se revoquen cuando el empleado deje de ser elegible (contrato vencido o documentos faltantes), puedes ejecutar la función `employee_wallet_sync_eligibility` de forma periódica.

### 9.1 RPC en Supabase

La migración que crea `employee_wallet_sync_eligibility()` debería estar aplicada (Paso 1). La RPC recorre los registros de `employee_wallet_cards` con estado `issued` y, si `employee_wallet_eligibility` indica que ya no son elegibles, actualiza el estado a `revoked`.

### 9.2 Opción A: Edge Function + cron externo

1. En vento-anima existe (o puedes crear) una Edge Function que llame a la RPC con **service role** (o un secret que solo conozca el cron). Ejemplo de cuerpo de la función:
   - Obtener `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL` del entorno.
   - Cliente Supabase con service role → `supabase.rpc('employee_wallet_sync_eligibility')`.
   - Devolver el resultado en JSON.
2. Proteger la función con un header o query (ej. `Authorization: Bearer CRON_SECRET`). Configura `CRON_SECRET` en los secrets de la Edge Function.
3. En un servicio de cron (Vercel Cron, GitHub Actions, o el que uses), programa una petición POST/GET a esa función con el secret, por ejemplo una vez al día.

### 9.3 Opción B: pg_cron (si está habilitado en tu plan Supabase)

Si tu proyecto tiene **pg_cron** habilitado:

1. En SQL Editor:
   ```sql
   select cron.schedule(
     'employee-wallet-sync-eligibility',
     '0 2 * * *',  -- todos los días a las 02:00
     $$select public.employee_wallet_sync_eligibility()$$
   );
   ```
2. Ajusta el horario según tu zona horaria y necesidad.

---

## 10. Verificación y pruebas

### 10.1 En VISO

1. Entra a un **negocio** → pestaña/sección "Documentos requeridos y carnet laboral".
2. Comprueba que el tipo "Contrato laboral" esté y que haya al menos una regla requerida para una sede.
3. Entra a un **trabajador** de esa sede → "Documentos y carnet laboral".
4. Sube un contrato vigente (tipo Contrato laboral) y los demás documentos requeridos. Comprueba que el panel muestre "Elegible" y estado del carnet.

### 10.2 En la app ANIMA (empleado)

1. Inicia sesión con un usuario que sea **empleado** de esa sede y que tenga contrato y documentos completos.
2. En la **Home** debe aparecer la card **"Carnet laboral"** con el botón **"Agregar a Wallet"**.

**Android:**

3. Pulsa "Agregar a Wallet". Debe abrirse la pantalla de Google Wallet con el pase listo para añadir.
4. Añade el pase y comprueba que se vea el nombre, cargo, sede y vigencia.

**iOS:**

5. Pulsa "Agregar a Wallet". Debe abrirse Safari (o in-app browser) y descargarse el .pkpass; iOS preguntará si quieres añadirlo a Wallet.
6. Añade el pase y comprueba que coincida con el diseño esperado (logo, nombre, cargo, sede, vigencia, QR).

### 10.3 No elegible

1. En VISO, quita el contrato o un documento requerido del empleado.
2. En ANIMA, vuelve a la Home (o recarga). La card debe mostrar "Carnet no disponible" y el motivo (sin contrato vigente o faltan documentos), **sin** botón "Agregar a Wallet".

### 10.4 Revocación (si configuraste el cron)

1. Con un carnet ya emitido (estado `issued` en `employee_wallet_cards`), en VISO vence el contrato o quita un documento requerido.
2. Ejecuta manualmente la RPC `employee_wallet_sync_eligibility()` (o espera al cron).
3. Comprueba en la base de datos que el registro de ese empleado en `employee_wallet_cards` tenga `status = 'revoked'` y `revocation_reason` correcto.

---

## 11. Problemas frecuentes

| Síntoma | Qué revisar |
|--------|----------------------|
| "Configuración de la app incompleta" | `EXPO_PUBLIC_SUPABASE_URL` no está definida o no se cargó en el build. |
| Android: 401/500 al pulsar "Agregar a Wallet" | Token de sesión inválido o secrets de la Edge Function `employee-wallet-pass` (Issuer ID, Class ID, JSON de la cuenta de servicio). |
| Android: "Missing Google Wallet configuration" | Faltan uno o más de: `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_EMPLOYEE_CLASS_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` en los secrets de la función. |
| iOS: se abre la URL pero no se descarga el pase / error 501 | Si usas la Edge Function por defecto: es normal (501). Configura `EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE` y despliega `employee-wallet-api` en Vercel. |
| iOS: 401 desde Vercel | Token expirado o inválido. La API valida el token con `SUPABASE_URL` + `SUPABASE_ANON_KEY`; asegúrate de que sean del mismo proyecto que usa la app. |
| iOS: 403 "No elegible" | El empleado no tiene contrato vigente o le faltan documentos requeridos. Revisa en VISO y la RPC `employee_wallet_eligibility`. |
| iOS: 500 "Pass creation failed" / "Missing env" | En Vercel revisa todas las variables del Paso 7.2, sobre todo certificados en base64 y `APPLE_PASS_P12_PASSWORD`. |
| Error al firmar el pase (certificado) | Verifica que el .p12 sea el correcto para el Pass Type ID, que la contraseña sea la buena y que el WWDR sea el PEM correcto en base64. |
| La card "Carnet laboral" no sale | El usuario no está identificado como empleado o la RPC `employee_wallet_eligibility` falla; revisa que las migraciones estén aplicadas y que exista la fila en `employees` para ese `auth.uid()`. |

---

## Resumen rápido de URLs y variables

- **Supabase ANIMA**: `EXPO_PUBLIC_SUPABASE_URL` → Edge Function `employee-wallet-pass` para Android.
- **Vercel employee-wallet-api**: `EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE` → `/api/employee-apple-pass` para iOS.
- **Certificados Apple**: .p12 y WWDR en base64 + Pass Type ID + Team ID + logo/icono URLs en Vercel.
- **Google Wallet**: Issuer ID, Class ID de clase Generic de empleado, y JSON de cuenta de servicio en secrets de la Edge Function.

Si sigues esta guía en orden, tendrás el carnet laboral operativo en Android e iOS y, opcionalmente, la revocación automática cuando cambie la elegibilidad.
