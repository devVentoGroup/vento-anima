# Auditoría build ANIMA — subida a tienda

Fecha: 2026-03. Versión actual en tienda: **1.1.0**. Este documento revisa EAS, versión, y política de actualización forzada para la próxima build.

---

## 1. Configuración EAS (`eas.json`)

| Aspecto | Estado | Notas |
|--------|--------|--------|
| **CLI** | OK | `"version": ">= 16.28.0"` |
| **appVersionSource** | OK | `"remote"`: la versión la toma EAS del proyecto (app.config.js). |
| **Producción** | OK | `autoIncrement: true`: iOS buildNumber y Android versionCode se incrementan solos en cada build. |
| **Canales** | OK | development, preview, production con `APP_VARIANT` correcto. |
| **Submit** | OK | `submit.production: {}` listo para `eas submit`. |

No hace falta cambiar nada en `eas.json` para la próxima build.

---

## 2. Versión de la app

- **app.config.js**: `version` (string que ve el usuario), `ios.buildNumber`, `android.versionCode`.
- **package.json**: `version` (solo informativo; la que cuenta es la de app.config.js).

Para la **próxima** build (la que vas a subir) se recomienda:

- **Versión:** `1.1.1` (patch sobre 1.1.0). Si en tu caso la build que subes sigue siendo 1.1.0, deja `1.1.0`.
- **iOS buildNumber** y **Android versionCode**: no es necesario tocarlos a mano; con `autoIncrement: true` EAS los sube en cada build de producción.

Comandos útiles después de subir la build:

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
```

---

## 3. Actualización forzada (política en BD)

La app lee la tabla **`app_update_policies`** (por `app_key` + `platform`). No hay lógica de “min version” ni “force” hardcodeada en la app; todo se controla desde la BD.

### Cómo funciona

- **`min_version`**: si la versión instalada es **menor** que esta, se muestra modal **obligatorio** (no se puede cerrar; hay que ir a la tienda).
- **`latest_version`**: versión más reciente publicada.
- **`force_update`**: si es `true` y la versión instalada es **menor** que `latest_version`, se considera actualización **obligatoria** (mismo modal, sin “Más tarde”).
- **`store_url`**: enlace a App Store / Play Store. Si falta o es placeholder (`id0000000000`), el botón “Actualizar” se desactiva (la app evita abrir URLs inválidas).

Lógica en código (`use-app-update-policy.ts`):

- `belowMin` = versión instalada < `min_version` → obligatorio.
- `shouldForce` = `force_update === true` y versión instalada < `latest_version` → obligatorio.
- Si no es obligatorio pero hay `latest_version` mayor que la instalada → actualización **opcional** (se puede cerrar con “Más tarde”).

### Estado actual (tras migraciones)

- **vento_anima** (producción): `min_version = 1.1.0`, `latest_version = 1.1.0`, `force_update = false`, iOS con `store_url` real (migración `20260312150000_anima_ios_store_url_non_listed.sql`).
- **vento_anima_dev**: política desactivada (`is_enabled = false`).

La actualización forzada está **bien configurada**: no depende del código, solo de la BD.

### Después de publicar la nueva build (ej. 1.1.1)

Actualizar la BD para que la app ofrezca/obligue a la nueva versión:

```sql
-- Opción A: solo indicar que hay una versión más nueva (modal opcional para quien tenga < 1.1.1)
update app_update_policies
set latest_version = '1.1.1', updated_at = now()
where app_key = 'vento_anima' and platform in ('ios','android');

-- Opción B: forzar a todo el mundo a actualizar a 1.1.1 (modal obligatorio si tiene < 1.1.1)
update app_update_policies
set latest_version = '1.1.1', min_version = '1.1.1', force_update = true, updated_at = now()
where app_key = 'vento_anima' and platform in ('ios','android');
```

- **Solo aviso (opcional):** usar solo la Opción A.
- **Forzar actualización:** usar la Opción B. Así ningún usuario se queda en 1.1.0 sin poder usar la app hasta actualizar.

---

## 4. Checklist pre-build

- [ ] Versión en `app.config.js` = la que quieres publicar (ej. `1.1.1`).
- [ ] `APP_VARIANT` = `production` en el profile de build (ya está en `eas.json` para production).
- [ ] Migraciones aplicadas en el proyecto que usa la app (incl. `app_update_policies` y, si aplica, `20260312150000` para store_url iOS).
- [ ] Tras publicar en tienda: actualizar `app_update_policies` con `latest_version` (y si quieres forzar, `min_version` + `force_update`) como arriba.

---

## 5. Resumen

| Tema | ¿Listo para build? | Acción |
|-----|--------------------|--------|
| EAS | Sí | Ninguna. |
| Versión | Sí | Subir a 1.1.1 en app.config.js (y package.json) para la próxima release. |
| Actualización forzada | Sí | Configurada en BD; tras publicar 1.1.1, actualizar `latest_version` (y opcionalmente `min_version` + `force_update`). |
| Store URLs | Sí | iOS con URL real en migración; Android con Play Store en política. |
