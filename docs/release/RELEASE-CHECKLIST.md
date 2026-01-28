# Vento Anima - Release Roadmap (Checklist)

> Objetivo: dejar un paso a paso claro para lanzar la app sin olvidos.

## 0. Alcance y version

- [x] Definir fecha objetivo del release (31 enero 2026)
- [ ] Congelar features (solo bugs y ajustes finales)
- [x] Confirmar version de app (semver) y build number (1.0.1 / build 2)

## 1. Repo y calidad

- [x] Pull de main / rama de release ✅
- [x] Git add, commit y push ✅
- [x] Instalar dependencias (`npm i`) ✅
- [x] **ARREGLADO**: Sistema de geolocalización mejorado:
  - Coordenadas siempre frescas de BD (no caché)
  - Detección automática de sede más cercana
  - Manejo de sedes con coordenadas idénticas (selector)
  - Lógica basada en coordenadas, no en tipo de sede
- [x] Revisar errores TS en la app ✅ (0 errores encontrados)
- [ ] Smoke test manual: login, home, check-in/out, documentos, equipo
  - [x] Login/logout ✅
  - [x] Home (carga correctamente) ✅
  - [x] Documentos: subir, visualizar, eliminar, filtrar por trabajador ✅
  - [ ] Check-in/out (pendiente verificar en todas las sedes)
  - [ ] Equipo (pendiente verificar)
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
- [x] **NUEVO**: Aplicar fixes de documentos:
  - `supabase/sql/2026-01-28_fix_document_types.sql` (nombres claros, orden de prioridad) ✅
  - `supabase/sql/2026-01-28_documents_upload_permissions.sql` (solo gerentes pueden subir) ✅
  - `supabase/sql/2026-01-28_documents_select_permissions.sql` (trabajadores solo ven sus documentos) ✅
  - `supabase/sql/2026-01-28_documents_delete_permissions.sql` (solo gerentes pueden eliminar) ✅
  - Políticas de Storage aplicadas (bucket público, políticas INSERT/UPDATE/DELETE) ✅
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
- [x] Revisar logs de Edge Functions en dashboard de Supabase ✅
  - Sin logs porque no se han usado aún (normal)
  - Funciones deployadas correctamente

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

- [ ] `eas build -p ios --profile production` (pendiente rebuild con fixes de producción)
- [ ] `eas build -p android --profile production` (pendiente rebuild con fixes de producción)
- [ ] Instalar builds en dispositivos reales
- [ ] Test en build release (no dev client)

## 7. Publicacion

- [ ] iOS: subir a TestFlight, metadata, screenshots, privacy
- [x] Android: App creada en Play Console ✅
- [x] Android: Subir build con `eas submit -p android --profile production` ✅
- [ ] Android: Completar ficha de Play Store (nombre, descripción, screenshots)
- [ ] Android: Completar Data Safety
- [ ] Android: Enviar para revisión de Google
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

### Mejoras de Documentos (28 enero 2026)

- ✅ **Orden del formulario mejorado**: Tipo → PDF → Descripción (más intuitivo)
- ✅ **Tipos de documentos arreglados**:
  - Eliminado tipo confuso "Para saber si requiere contrato"
  - Eliminado "Fecha de ingreso" (es un dato, no un documento)
  - Nombres más claros (tildes, formato correcto)
  - Orden de prioridad: Contrato → Salud → Alimentos → Dotación
  - Campo `display_order` agregado para ordenamiento
- ✅ **Permisos de documentos**:
  - Solo gerentes pueden subir documentos (propietarios, gerentes generales, gerentes de sede)
  - Trabajadores solo ven sus propios documentos personales y documentos de su sede
  - Selector de trabajador al subir documentos (para gerentes)
  - Filtro de trabajador en la vista (para gerentes)

### Mejoras de UI y Performance (28 enero 2026)

- ✅ **Botón de check-in mejorado**: Diseño más moderno, sin barra rara de color
- ✅ **Fix de recargas múltiples**: Refs agregados para evitar loops infinitos en useEffect
- ✅ **Fix de carga inicial**: Mejor manejo de estados de carga y timeouts
- ✅ **Fix de push tokens**: Timeouts agregados para evitar peticiones pendientes

### Fixes Críticos de Documentos (28 enero 2026)

- ✅ **Upload de PDFs arreglado**: Cambio de Blob a ArrayBuffer (archivos ya no se suben vacíos)
- ✅ **Filtro por trabajador**: Modal separado funcionando correctamente
- ✅ **Eliminar documentos**: Funciona sin quedarse pegado
- ✅ **Visualización de PDFs**: Se abren correctamente en navegador externo
- ✅ **Políticas de Storage**: Bucket público configurado, políticas INSERT/UPDATE/DELETE aplicadas

### Fixes Críticos de Producción (28 enero 2026)

- ✅ **Fix de carga del home en producción**: Permite que employee sea null y carga asistencia de todos modos
- ✅ **Fix de check-in fallando primera vez**: 
  - Verificación inmediata del geofence al cargar el home
  - Espera activa hasta 8 segundos con múltiples reintentos antes de fallar
  - Detecta estado "idle" y fuerza verificación inmediata antes de proceder
  - Retry automático si el geofence está "checking" o no está listo
