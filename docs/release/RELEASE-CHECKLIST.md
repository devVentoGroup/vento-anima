# Vento Anima - Release Roadmap (Checklist)

> Objetivo: dejar un paso a paso claro para lanzar la app sin olvidos.

## 0. Alcance y version

- [x] Definir fecha objetivo del release (31 enero 2026)
- [ ] Congelar features (solo bugs y ajustes finales)
- [x] Confirmar version de app (semver) y build number (1.0.1 / build 2)

## 1. Repo y calidad

- [ ] Pull de main / rama de release
- [ ] Instalar dependencias (`npm i`)
- [x] **ARREGLADO**: Sistema de geolocalización mejorado:
  - Coordenadas siempre frescas de BD (no caché)
  - Detección automática de sede más cercana
  - Manejo de sedes con coordenadas idénticas (selector)
  - Lógica basada en coordenadas, no en tipo de sede
- [x] Revisar errores TS en la app ✅ (0 errores encontrados)
- [ ] Smoke test manual: login, home, check-in/out, documentos, equipo
- [x] **Test crítico**: Verificar check-in en Centro de Producción ✅
- [ ] **Test crítico**: Verificar check-out en Saudo (en progreso)
- [ ] **Test crítico**: Verificar selector cuando hay sedes con coordenadas idénticas (Vento Group/Café) - pendiente

## 2. Base de datos (Supabase)

- [x] Aplicar SQL pendientes (confirmado en schema.sql):
  - `supabase/sql/2026-01-27_document_types.sql`
  - `supabase/sql/2026-01-27_documents_rls.sql`
  - `supabase/sql/2026-01-27_team_rls.sql`
  - `supabase/sql/2026-01-27_push_tokens.sql`
  - `supabase/sql/2026-01-28_attendance_multisite.sql`
- [x] **CRÍTICO**: Aplicar fix de geolocalización:
  - `supabase/sql/FIX_attendance_geofence.sql` ✅ (actualiza trigger para usar coordenadas en lugar de tipo)
- [x] Verificar RLS de: `documents`, `document_types`, `employees`, `employee_sites`
- [x] Verificar buckets: `documents` (lectura/escritura)
- [x] Extensiones activas: `pg_cron`, `pg_net` (para alertas)
- [x] Verificar coordenadas de todas las sedes en tabla `sites`:
  - Centro de Producción debe tener coordenadas correctas ✅
  - Vento Group y Vento Café pueden tener coordenadas idénticas (correcto) ✅

## 3. Edge Functions

- [x] Deploy funciones:
  - `supabase/functions/staff-invitations-create`
  - `supabase/functions/staff-invitations-accept`
  - `supabase/functions/document-alerts`
  - `supabase/functions/attendance-report` (si aplica)
- [ ] Revisar logs de Edge Functions en dashboard de Supabase
  - Verificar que no haya errores recientes
  - Confirmar que todas las funciones responden correctamente

## 4. Alertas de documentos

- [x] Guardar secreto:
  - `DOCUMENT_ALERTS_CRON_SECRET`
- [x] Programar cron (SQL Editor con `cron.schedule`)
- [x] Test manual con `net.http_post` a `/functions/v1/document-alerts`
- [x] Verificar que se guarden `employee_push_tokens`

## 5. Configuracion de app

- [x] Revisar `app.config.js` / `app.json` (permisos, iconos, splash) ✅
  - Versión: 1.0.1
  - Build number: 2 (iOS y Android)
  - Permisos de ubicación configurados ✅
  - Permisos de notificaciones configurados ✅
  - Iconos y splash configurados ✅
- [x] Verificar `EXPO_PROJECT_ID` ✅ (2e1ba93a-039d-49e7-962d-a33ea7eaf9b3)
- [x] Verificar permisos de notificaciones y ubicacion ✅

## 6. Builds (EAS)

- [ ] `eas build -p ios --profile production`
- [ ] `eas build -p android --profile production`
- [ ] Instalar builds en dispositivos reales
- [ ] Test en build release (no dev client)

## 7. Publicacion

- [ ] iOS: subir a TestFlight, metadata, screenshots, privacy
- [ ] Android: subir a Play Console, ficha, data safety
- [ ] Revisión final de check-in/out en prod

## 8. Post-release

- [ ] Monitorear errores y logs 24-48h
- [ ] Verificar primer cron de alertas
- [ ] Confirmar invitaciones y roles en produccion
- [ ] Verificar que check-ins funcionen correctamente en todas las sedes
- [ ] Confirmar que selector funciona para sedes con coordenadas idénticas

---

## Cambios recientes (28 enero 2026)

### Sistema de Geolocalización - Arreglos Críticos

- ✅ **Coordenadas siempre frescas**: `resolveSite()` ahora siempre consulta BD, no usa caché
- ✅ **Detección automática de sede más cercana**: Con múltiples sedes, selecciona automáticamente la más cercana
- ✅ **Manejo de coordenadas idénticas**: Detecta cuando Vento Group y Vento Café comparten ubicación y muestra selector
- ✅ **Lógica basada en coordenadas**: Cualquier sede con coordenadas funciona con GPS, sin importar tipo
- ✅ **Backend actualizado**: `FIX_attendance_geofence.sql` aplicado en Supabase ✅

### Mejoras de UI (28 enero 2026)
- ✅ **Contador de tiempo en tiempo real**: Actualiza cada segundo cuando hay check-in activo
- ✅ **Formato mejorado**: Muestra HH:MM:SS cuando está activo, HH:MM cuando no
- ✅ **Formato de horas estándar**: Entrada/Salida siempre en formato 24h (09:02, 13:25)
- ✅ **Texto optimizado**: Cambiado "tiempo trabajado" por "activo" para evitar overflow
