# Roadmap ANIMA - Estructuracion Operativa y Tecnica

> Documento vivo para definir la evolucion de ANIMA con criterio de producto, datos y arquitectura.
> Fecha de inicio: 2026-03-13.
> Estado: borrador estructural.

---

## 0. Vision

ANIMA debe quedar organizada como un producto de operacion de personal con cuatro objetivos simultaneos:

1. Resolver flujos reales del dia a dia sin depender de Excel ni procesos manuales dispersos.
2. Separar claramente que vive en movil, que vive en web y que vive en backend.
3. Quitar reglas hardcodeadas del codigo y moverlas a configuracion o politicas de base de datos.
4. Preparar el dominio para migrar desde `public` hacia un schema propio `anima` sin romper produccion.

---

## 1. Problema Actual

Hoy ANIMA ya cubre una parte fuerte de la operacion:

- asistencia con geofence
- equipo e invitaciones
- historial
- anuncios
- soporte
- documentos

Pero todavia tiene cuatro debilidades estructurales:

1. Falta una capa formal de "estado de invitaciones".
2. Falta un modulo usable de turnos para dejar Excel.
3. Muchas reglas operativas siguen embebidas en app, SQL o funciones.
4. El dominio sigue mezclado en `public`, lo que dificulta ordenar ANIMA como producto propio.

---

## 2. Principios de Estructura

- Primero producto critico, despues reorganizacion interna.
- No construir planners complejos mobile-first.
- Mismo dominio, diferentes superficies: movil para ejecucion, web para operacion densa.
- Las reglas de negocio deben vivir en BD o capa de dominio, no repartidas en UI.
- La migracion de schema debe ser gradual y reversible por etapas.
- Todo modulo nuevo debe nacer pensando en `anima.*`, aunque temporalmente conviva con `public`.

---

## 3. Mapa del Producto ANIMA

### 3.1 Dominios funcionales

#### A. Identidad laboral
Responsabilidad:
- empleados
- roles
- sedes asignadas
- estado activo/inactivo
- invitaciones y acceso

#### B. Asistencia
Responsabilidad:
- check-in / check-out
- breaks
- geofence
- historial
- incidencias
- exportes

#### C. Programacion
Responsabilidad:
- turnos
- publicacion de horario
- confirmacion de turno
- cambios y cancelaciones
- recordatorios

#### D. Cumplimiento documental
Responsabilidad:
- documentos requeridos
- documentos cargados
- vencimientos
- alertas
- futura firma

#### E. Comunicacion operativa
Responsabilidad:
- anuncios
- notificaciones push
- soporte interno
- mensajes operativos

#### F. Configuracion de negocio
Responsabilidad:
- politicas de asistencia
- capacidades por rol
- configuracion por sede
- feature flags operativos
- timezone / locale / links / copy operativo

### 3.2 Orden de madurez recomendado

1. Identidad laboral
2. Asistencia
3. Programacion
4. Configuracion de negocio
5. Cumplimiento documental
6. Comunicacion operativa refinada

---

## 4. Separacion de Superficies: Movil vs Web

## 4.1 Lo que debe vivir en ANIMA movil

### Empleado
- login y acceso
- ver su asistencia actual
- registrar entrada / salida / descanso
- ver historial personal
- ver sus proximos turnos
- recibir notificaciones
- ver documentos asignados
- soporte

### Manager
- ver resumen operativo rapido
- crear o editar un turno puntual
- gestionar una invitacion puntual
- ver pendientes
- resolver acciones rapidas

## 4.2 Lo que no deberia ser mobile-first

### Web / Shell / panel operativo
- planeacion semanal o quincenal de 20+ empleados
- tablas densas con cruces por empleado / dia / sede
- copiado masivo de semanas
- redistribucion operativa masiva
- auditoria mas compleja
- configuracion administrativa avanzada

## 4.3 Regla de diseño

Si una tarea exige:
- comparar muchos empleados a la vez
- ver varias fechas en simultaneo
- editar muchas celdas o bloques
- copiar, mover o validar en lote

entonces esa tarea debe resolverse en web.

---

## 5. Estructura del Roadmap por fases

## Fase 1. Invitaciones pendientes y reenvio

### Objetivo
Formalizar el ciclo de invitacion para que Equipo no sea solo un CRUD de empleados existentes, sino tambien una bandeja operativa de acceso pendiente.

### Problema a resolver
Hoy puede existir alguno de estos estados sin una representacion clara en la app:
- invitado que aun no acepta
- usuario ya existente en Auth pero sin password util para ANIMA
- invitacion que expiro
- necesidad de reenviar acceso

### Estructura deseada

#### Capa de datos
- [ ] Crear una fuente de verdad para invitaciones pendientes.
- [ ] Persistir cada invitacion emitida.
- [ ] Registrar transiciones: enviada, reenviada, aceptada, expirada, cancelada.

#### Capa backend
- [ ] Ajustar el flujo de creacion para que escriba estado.
- [ ] Crear flujo de reenvio idempotente.
- [ ] Evitar duplicacion de empleados.

#### Capa app
- [ ] Agregar vista de pendientes en Equipo.
- [ ] Exponer acciones: reenviar, cancelar, revisar estado.
- [ ] Mostrar mensajes distintos segun caso.

### Modelo sugerido

Tabla sugerida: `anima.staff_invitations`

Campos base:
- [ ] `id`
- [ ] `email`
- [ ] `full_name`
- [ ] `role_code`
- [ ] `site_id`
- [ ] `status`
- [ ] `auth_user_id`
- [ ] `invited_by`
- [ ] `invited_at`
- [ ] `last_sent_at`
- [ ] `accepted_at`
- [ ] `expired_at`
- [ ] `resend_count`
- [ ] `metadata`

### Definition of Done
- [ ] Equipo muestra pendientes reales.
- [ ] Reenvio funciona sin duplicados.
- [ ] El manager entiende el estado sin ir a Supabase.

---

## Fase 2. Turnos programados

### Objetivo
Eliminar dependencia de Excel sin forzar una UX movil improductiva.

### Decision estructural
El dominio de turnos se construye una sola vez, pero se consume desde dos superficies:

#### ANIMA movil
- consumo por empleado
- ajustes puntuales por manager

#### Web
- construccion masiva del horario
- operaciones de alta densidad

### MVP recomendado

#### Para empleado
- [ ] Pantalla `Mis turnos`.
- [ ] Tarjeta de siguiente turno en Home.
- [ ] Notificacion cuando le asignan o cambian turno.

#### Para manager en movil
- [ ] Crear turno individual.
- [ ] Editar turno individual.
- [ ] Cancelar o confirmar turno.
- [ ] Resolver reemplazos simples.

#### Para web
- [ ] Planner semanal por empleados.
- [ ] Copiar semana.
- [ ] Validar solapes.
- [ ] Gestion por sede.

### Regla de alcance
No intentar desde ANIMA movil:
- planner completo por grilla
- bulk edit intensivo
- copy masivo de horario
- comparativo visual de muchas personas por semana

### Modelo de datos
Base sugerida: `employee_shifts` evolucionada hacia `anima.employee_shifts`

Campos a confirmar:
- [ ] `employee_id`
- [ ] `site_id`
- [ ] `shift_date`
- [ ] `start_time`
- [ ] `end_time`
- [ ] `break_minutes`
- [ ] `status`
- [ ] `notes`
- [ ] `published_at`
- [ ] `published_by`
- [ ] `confirmed_at`
- [ ] `confirmed_by_employee`
- [ ] `origin`
- [ ] `template_id` opcional

Estados sugeridos:
- [ ] `draft`
- [ ] `published`
- [ ] `confirmed`
- [ ] `completed`
- [ ] `cancelled`
- [ ] `no_show`

### Integracion con asistencia
- [ ] Mostrar proximo turno en Home.
- [ ] Relacionar check-in real con turno programado.
- [ ] Calcular tardanza o cumplimiento sin bloquear el check-in en MVP.

### Definition of Done
- [ ] Empleado ve sus turnos en ANIMA.
- [ ] Manager resuelve turnos puntuales desde movil.
- [ ] La planificacion densa queda reservada para web.

---

## Fase 3. Parametrizacion en base de datos

### Objetivo
Sacar del codigo las reglas operativas criticas y volverlas configurables.

### Criterio
Toda regla que hoy obligue a cambiar app o SQL para ajustar operacion debe evaluarse para vivir en BD.

### Prioridad 1. Politicas de asistencia

#### Tabla sugerida: `anima.attendance_policy`
Campos sugeridos:
- [ ] `checkin_max_distance_meters`
- [ ] `checkout_max_distance_meters`
- [ ] `checkin_max_accuracy_meters`
- [ ] `checkout_max_accuracy_meters`
- [ ] `default_site_radius_meters`
- [ ] `retry_attempts`
- [ ] `retry_delay_ms`
- [ ] `late_tolerance_minutes`
- [ ] `allow_offline_queue`

#### Tabla sugerida: `anima.site_policies`
Campos sugeridos:
- [ ] `site_id`
- [ ] `requires_geofence`
- [ ] `checkin_radius_meters`
- [ ] `checkout_radius_meters`
- [ ] `allow_manual_override`
- [ ] `late_tolerance_minutes`

### Prioridad 2. Capacidades por rol

#### Tabla sugerida: `anima.role_capabilities`
Ejemplos de capacidades:
- [ ] `team.view`
- [ ] `team.invite`
- [ ] `team.edit`
- [ ] `attendance.export`
- [ ] `shift.create`
- [ ] `shift.publish`
- [ ] `documents.manage`
- [ ] `announcements.manage`

### Prioridad 3. Config global

#### Tabla sugerida: `anima.app_config`
Usos:
- [ ] locale
- [ ] timezone
- [ ] links operativos
- [ ] feature flags
- [ ] parametros de notificaciones
- [ ] textos globales criticos

### Prioridad 4. Politicas de turnos

#### Tabla sugerida: `anima.shift_policies`
- [ ] `publish_notice_hours`
- [ ] `reminder_minutes_before`
- [ ] `max_shift_hours`
- [ ] `min_break_minutes`
- [ ] `allow_overlap`
- [ ] `allow_same_day_reassignment`

### Definition of Done
- [ ] Las reglas criticas viven en BD.
- [ ] La app y el SQL dejan de duplicar decisiones centrales.
- [ ] Se pueden ajustar politicas operativas sin release en casos previstos.

---

## Fase 4. Migracion de `public` a schema `anima`

### Objetivo
Separar el dominio ANIMA para que su evolucion no quede mezclada con otras apps del ecosistema.

### Regla principal
No migrar todo de una vez. Migrar por capas y con compatibilidad temporal.

### 4.1 Inventario
- [ ] Listar tablas ANIMA en `public`.
- [ ] Listar funciones y triggers ANIMA.
- [ ] Listar vistas, policies y edge functions dependientes.
- [ ] Clasificar que es exclusivo de ANIMA y que es compartido.

### 4.2 Frontera de dominio

#### Exclusivo ANIMA o candidato fuerte
- [ ] attendance logs y breaks
- [ ] employee shifts
- [ ] invitaciones laborales
- [ ] announcements ANIMA
- [ ] support tickets ANIMA
- [ ] configuraciones y politicas ANIMA

#### Compartido o a revisar antes de mover
- [ ] employees
- [ ] employee_sites
- [ ] roles
- [ ] sites
- [ ] document_types si se comparte con otras apps

### 4.3 Estrategia de migracion

#### Etapa A. Crear schema y tablas nuevas
- [ ] Crear schema `anima`.
- [ ] Crear ahi todos los modulos nuevos.
- [ ] Evitar que lo nuevo nazca en `public`.

#### Etapa B. Mover configuracion
- [ ] app_config
- [ ] attendance_policy
- [ ] site_policies
- [ ] role_capabilities
- [ ] shift_policies

#### Etapa C. Mover turnos e invitaciones
- [ ] mover o recrear `employee_shifts`
- [ ] crear `staff_invitations`
- [ ] adaptar app y funciones

#### Etapa D. Mover asistencia
- [ ] attendance core
- [ ] triggers y reportes
- [ ] exportes

#### Etapa E. Revisar equipo y documentos
- [ ] solo mover si la frontera ya esta clara con otras apps

### Compatibilidad temporal
- [ ] evaluar vistas puente en `public`
- [ ] evaluar funciones wrapper
- [ ] definir una ventana de transicion por modulo

### Definition of Done
- [ ] Los modulos nuevos ya viven en `anima`.
- [ ] La app no depende ciegamente de `public` para lo nuevo.
- [ ] Existe una ruta clara de salida para lo legacy.

---

## 6. Orden de Ejecucion Recomendado

### Etapa 1. Producto critico
1. Invitaciones pendientes y reenvio.
2. MVP de turnos para empleado y manager puntual.

### Etapa 2. Gobernanza de reglas
3. attendance_policy
4. site_policies
5. role_capabilities
6. app_config
7. shift_policies

### Etapa 3. Reorganizacion del dominio
8. Crear schema `anima`.
9. Hacer que todo modulo nuevo nazca ahi.
10. Migrar modulos existentes por capas.

---

## 7. Criterios para Tomar Decisiones

### Cuando algo debe ir a movil
- lo usa el trabajador en contexto real
- requiere inmediatez
- es accion puntual
- no exige comparar muchas entidades a la vez

### Cuando algo debe ir a web
- requiere vista densa o masiva
- involucra planeacion semanal o por lotes
- necesita comparacion entre muchos empleados o sedes
- exige muchas ediciones consecutivas

### Cuando algo debe ir a BD como politica
- cambia por operacion, no por software
- puede variar por sede o rol
- hoy esta duplicado entre app y SQL
- no deberia obligar a sacar release

---

## 8. Backlog posterior

- [ ] Incidencias de asistencia con aprobacion.
- [ ] Firma de documentos en app.
- [ ] Planner web avanzado de turnos.
- [ ] Portal de postulantes separado del flujo de empleado.
- [ ] Reportes de puntualidad, ausencias y horas por sede.

---

## 9. Decision Log

### 2026-03-13
- [x] Se prioriza resolver invitaciones pendientes y reenvio.
- [x] Se decide que turnos si entran en roadmap.
- [x] Se decide que el planner masivo no debe ser mobile-first.
- [x] Se pospone firma de documentos.
- [x] Se acuerda parametrizar BD antes de migracion completa a schema propio.
- [x] Se acuerda migrar por capas y no mover todo desde `public` de una sola vez.

---

## 10. Proximo entregable sugerido

### Documento tecnico siguiente
- [ ] `docs/ANIMA-INVITACIONES-PENDIENTES-DISENO.md`

Contenido esperado:
- modelo de datos
- edge functions involucradas
- cambios en `team.tsx`
- casos de negocio
- estrategia de reenvio

### Documento tecnico posterior
- [ ] `docs/ANIMA-TURNOS-MVP.md`

Contenido esperado:
- alcance movil vs web
- datos minimos
- estados de turno
- notificaciones
- integracion con asistencia
