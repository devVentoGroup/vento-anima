# Employee Wallet API (ANIMA – Apple Pass)

Sirve el `.pkpass` del **carnet laboral** para Apple Wallet. Usa el Supabase de ANIMA (elegibilidad, empleado, sede).

## Despliegue (Vercel)

1. En Vercel, crea un proyecto con **root** = `employee-wallet-api` (o el directorio donde está este README).
2. Configura las variables de entorno (Settings → Environment Variables).

## Variables de entorno

| Variable | Requerido | Descripción |
|----------|-----------|-------------|
| `SUPABASE_URL` | Sí | URL del proyecto Supabase de ANIMA |
| `SUPABASE_ANON_KEY` | Sí | Anon key (para validar el token del usuario) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Service role key (para RPC y tablas) |
| `APPLE_PASS_P12_BASE64` | Sí | Certificado .p12 en base64 |
| `APPLE_PASS_P12_PASSWORD` | Sí | Contraseña del .p12 |
| `APPLE_WWDR_PEM_BASE64` | Sí | WWDR (Apple) en PEM, contenido en base64 |
| `APPLE_PASS_TYPE_ID` | Sí | Pass Type ID del pase (ej. `pass.co.ventogroup.anima`) |
| `APPLE_TEAM_ID` | Sí | Team ID de Apple Developer |
| `APPLE_PASS_LOGO_URL` | Sí | URL del logo para el pase |
| `APPLE_PASS_ICON_URL` | Opc | URL del icono (por defecto logo) |
| `APPLE_EMPLOYEE_PASS_TYPE_ID` | Opc | Sobrescribe Pass Type ID solo para empleado |
| `APPLE_EMPLOYEE_ORG_NAME` | Opc | Nombre de organización en el pase (default: Vento) |
| `APPLE_EMPLOYEE_PASS_DESCRIPTION` | Opc | Descripción del pase (default: Carnet laboral) |
| `PASS_WEB_SERVICE_URL` | Opc | URL del web service para actualizaciones del pase |

## Uso desde la app ANIMA

Tras desplegar, en la app ANIMA define:

- `EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE` = URL del proyecto Vercel (ej. `https://anima-wallet.vercel.app`).

La app llamará a `{EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE}/api/employee-apple-pass?token=...`.

## Sin esta API (solo Supabase)

Si no despliegas esta API, la app usa por defecto la Edge Function `employee-apple-pass` del Supabase de ANIMA, que devuelve **501** (Apple pass no disponible). En ese caso el botón "Agregar a Wallet" en iOS abrirá la URL pero el usuario verá un error hasta que exista un servidor que sirva el `.pkpass` (esta API o otro).
