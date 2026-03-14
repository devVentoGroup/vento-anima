# Flujo de implementación ANIMA — una sola opción

> Orden único de tareas hasta completar Fase 2 (y apuntes para Fase 3/4).  
> Fecha: 2026-03-13. No hay ramas: se sigue este orden.

---

## Regla

- Implementar **en el orden indicado**.
- Marcar cada ítem como hecho cuando esté terminado y probado.
- No saltar ítems (salvo que se indique explícitamente “opcional”).

---

## Estado previo (ya hecho)

- [x] Fase 1: Invitaciones (tabla, create/accept/resend/cancel, bandeja en Equipo).
- [x] Campo Expira en modal de invitar (ANIMA).
- [x] Banner “Activar notificaciones” en Home cuando el permiso no está concedido.
- [x] Pantalla “Mis turnos” en ANIMA.
- [x] Planner semanal en VISO (copiar semana, publicar).
- [x] Flujo de publicación de turnos (`published_at`, migración correspondiente).

---

## Secuencia de implementación

### Bloque A — Turnos: empleado en ANIMA

1. **Tarjeta “Siguiente turno” en Home** — **HECHO**  
   - En `app/(app)/home.tsx`, reutilizar o conectar con la fuente de “próximo turno” (ya existe `loadNextScheduledShift` o equivalente).  
   - Mostrar una tarjeta fija en Home con: fecha, hora inicio–fin, sede, y enlace “Ver mis turnos”.  
   - Solo visible si hay al menos un turno publicado futuro para el empleado.  
   - Definición de hecho: el empleado ve en Home su próximo turno sin entrar a “Mis turnos”.

2. **Notificación al asignar o cambiar turno** — **HECHO**  
   - Backend: al publicar o actualizar turnos (VISO o función que persista en `employee_shifts`), disparar envío de push al empleado afectado (usar token de `register-push-token` o tabla equivalente).  
   - Mensaje tipo: “Tienes un turno nuevo” / “Tu turno del [fecha] fue actualizado”.  
   - Definición de hecho: cuando publican o editan un turno, el empleado recibe notificación push (si tiene permiso).

---

### Bloque B — Turnos: manager en ANIMA (móvil)

3. **Crear turno individual desde la app** — **HECHO**  
   - Nueva pantalla o modal en ANIMA (solo para roles con permiso: gerente/propietario): formulario para crear un turno (empleado, sede, fecha, hora inicio, hora fin, opcional descanso).  
   - Llamar a una edge function o RPC que inserte en `employee_shifts` con `status = 'draft'` o `'published'` según regla de producto.  
   - Definición de hecho: un manager puede crear un turno puntual desde la app sin usar VISO.

4. **Editar turno individual desde la app** — **HECHO**  
   - Desde “Mis turnos” o una vista de manager, permitir abrir un turno y editar: fecha, hora inicio/fin, empleado (si aplica), sede.  
   - Persistir cambios vía backend existente o RPC.  
   - Definición de hecho: el manager puede corregir un turno desde la app.

5. **Cancelar o confirmar turno desde la app** — **HECHO**  
   - Acciones “Cancelar turno” y “Confirmar turno” (según estados definidos en modelo: p. ej. `cancelled`, `confirmed`).  
   - Backend: actualizar `status` y campos de auditoría si existen.  
   - Definición de hecho: el manager puede cancelar o marcar como confirmado un turno desde la app.

6. **Reemplazos simples (manager)** — **HECHO**  
   - Flujo mínimo: “Reasignar turno” a otro empleado (cambiar `employee_id` del turno).  
   - Puede ser un paso más en la pantalla de edición del turno.  
   - Definición de hecho: el manager puede reasignar un turno a otra persona desde la app.

---

### Bloque C — Turnos: web (VISO)

7. **Validar solapes en el planner** — **HECHO**  
   - En `weekly-schedule-planner` (o en el backend al guardar): detectar solapamiento de turnos del mismo empleado (misma fecha, rangos de hora que se cruzan).  
   - Mostrar advertencia en UI y/o impedir guardar hasta resolver o confirmar.  
   - Definición de hecho: no se pueden guardar turnos que se solapan para el mismo empleado sin una advertencia clara.

8. **Gestión por sede en planner** — **HECHO**  
   - Si aún no está: filtrar o agrupar el planner por sede de forma clara (ya puede estar parcialmente; completar si falta).  
   - Definición de hecho: el usuario del planner puede trabajar por sede sin confusión.

---

### Bloque D — Integración asistencia / turnos

9. **Mostrar próximo turno en Home** — **HECHO**  
   - Ya cubierto por el ítem 1; se añadió el detalle “Según tu turno programado” en la tarjeta cuando es turno de hoy.  
   - Definición de hecho: en Home se ve claramente el turno del día o el próximo.

10. **Relacionar check-in con turno programado (opcional en MVP)** — **HECHO**  
    - Columna `attendance_logs.shift_id` (opcional); al hacer check-in en sede/fecha de un turno publicado se persiste la relación.  
    - En Home se muestra “Dentro de tu turno de hoy” cuando el check-in es en la sede del turno.  
    - No se bloquea check-in si no hay turno.  
    - Definición de hecho: se puede ver o registrar la relación entre asistencia y turno cuando aplica.

---

### Bloque E — Fase 3 (parametrización)

11. **Tabla y lectura de políticas de asistencia** — **HECHO**  
    - Tabla `public.attendance_policy` con: geofence (check-in/check-out max accuracy), tolerancia de tardanza, cache/latch de geofence, parámetros de departure.  
    - Hook `useAttendancePolicy()` lee el primer registro; la app usa esos valores con fallback a constantes.  
    - Definición de hecho: cambios de radio o tolerancia se hacen por BD, no por release.

12. **Tabla y lectura de políticas por sede** — **HECHO**  
    - Tabla `public.site_attendance_policy` (site_id PK, checkin_radius_meters, requires_geofence).  
    - En `resolveSite` se consulta opcionalmente; si hay fila se usan overrides, si no o falla se usa sites + coordenadas.  
    - Definición de hecho: configuración por sede vive en BD.

13. **Capacidades por rol** — **HECHO**  
    - Tabla `public.role_capabilities` (role, capability) con RLS de solo lectura para authenticated; seed para propietario/gerente_general/gerente con `shift.create`, `shift.edit`, `shift.cancel`, `team.view`, `team.invite`. Hook `useRoleCapabilities(role)` lee capacidades; en `shifts.tsx` se usa `shift.create` (fallback a MANAGEMENT_ROLES); en `team.tsx` se usan `team.view` y `team.invite` (fallback a MANAGEMENT_ROLES).  
    - Definición de hecho: permisos de “quién puede hacer qué” vienen de BD.

14. **Config global de app** — **HECHO**  
    - Tabla `public.app_config` (key, value jsonb) con RLS SELECT para authenticated y anon; seed locale=es-CO, timezone=America/Bogota, feature_flags={}. Textos clave con keys `text.*`.  
    - Hook `useAppConfig()` devuelve locale, timezone, featureFlags, getText(key) y loaded/refresh; fallback a defaults si falla la lectura.  
    - Definición de hecho: ajustes operativos sin tocar código.

15. **Políticas de turnos** — **HECHO**  
    - Tabla `public.shift_policy` (una fila: publication_notice_minutes, reminder_minutes_before_shift, max_shift_hours_per_day, min_hours_between_shifts) con RLS SELECT para authenticated; seed 60 min recordatorio, 12 h máx por turno.  
    - Hook `useShiftPolicy()` con fallback a defaults; en CreateShiftModal y EditShiftModal se valida duración frente a max_shift_hours_per_day.  
    - Definición de hecho: reglas de turnos configurables en BD.

---

### Bloque F — Fase 4 (schema anima)

16. **Inventario y migración a schema `anima`**  
    - Listar tablas/funciones ANIMA en `public`.  
    - Crear schema `anima` y migrar por capas (config → turnos/invitaciones → asistencia), con vistas o wrappers en `public` si hace falta durante la transición.  
    - Definición de hecho: lo nuevo nace en `anima` y hay ruta clara para el resto.

---

## Resumen del orden (una sola opción)

1. Tarjeta siguiente turno en Home  
2. Notificación al asignar/cambiar turno  
3. Crear turno individual (manager, app)  
4. Editar turno individual (manager, app)  
5. Cancelar / confirmar turno (manager, app)  
6. Reemplazos simples (reasignar empleado)  
7. Validar solapes en planner (VISO)  
8. Gestión por sede en planner (completar si falta)  
9. Refinar “próximo turno” en Home si falta  
10. (Opcional) Relacionar check-in con turno  
11–15. Fase 3: políticas y config en BD  
16. Fase 4: schema anima  

Al terminar cada ítem, marcar en este documento y seguir con el siguiente.
