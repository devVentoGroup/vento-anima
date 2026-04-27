# ANIMA UX + Turnos + Roles por sede

Fecha: 2026-04-11

## Objetivo

Hacer `ANIMA` mucho mas entendible para trabajadores y mas util para managers, sin convertir la app movil en un planner denso como `VISO`.

El criterio de producto queda asi:

- `VISO`: planner semanal, publicacion masiva, vista densa de gerencia.
- `ANIMA`: consulta operativa, semana visible, ajustes puntuales, accion movil rapida.

## Problemas detectados

### 1. Para empleados

- La app se siente mas compleja de lo que deberia.
- Home tiene demasiada densidad operativa.
- No existe una vista semanal clara y rapida.
- El empleado no entiende facil con quien comparte turno en la sede.
- El flujo de descansos ya no representa la operacion real.

### 2. Para managers

- La app permite acciones puntuales, pero no da una lectura semanal clara de la sede.
- La informacion esta mas orientada a cards/listas que a una semana operativa.
- Parte del valor sigue escondido o disperso.

### 3. Para el modelo de datos

- Hoy `employees.role` funciona como rol unico principal.
- Eso no modela bien casos reales donde una persona opera distinto por sede.

## Decision de producto

### Empleado

ANIMA debe sentirse como una app de cuatro cosas:

- ver si hoy trabaja
- registrar entrada o salida
- ver su semana
- revisar pendientes relevantes

### Manager / gerente / propietario

ANIMA movil no reemplaza el planner de `VISO`, pero si debe permitir:

- ver la semana de la sede
- saber quien trabaja cada dia
- abrir un turno puntual
- corregir o crear ajustes puntuales

## Decision UX

### Home

La home debe reducirse gradualmente a:

- estado de hoy
- proximo turno
- acceso claro a semana
- pendientes importantes

Se debe sacar del flujo principal:

- descanso
- exceso de diagnostico tecnico
- demasiados mensajes de sync/geofence

### Turnos

`shifts.tsx` pasa a ser una pantalla mucho mas central.

Debe tener:

- semana personal del empleado
- para managers: semana de la sede
- debajo, detalle o listas historicas

No debe intentar ser el planner completo de `VISO`.

## Fases de implementacion

### Fase 1. Semana visible

- Hacer visible la pestana de turnos.
- Agregar bloque "Esta semana" para el empleado.
- Agregar bloque "Semana de la sede" para roles de gestion.

### Fase 2. Simplificacion operativa

- Quitar CTA y flujo visible de descansos.
- Limpiar FAQ y copys asociados.
- Reducir cards y mensajes tecnicos en home.

### Fase 3. Jerarquia por rol

- Empleado: experiencia muy simple.
- Manager: supervision movil ligera.
- Propietario / gerente general: misma experiencia manager con alcance mayor.

### Fase 4. Alineacion con VISO

- Mantener mismo lenguaje entre planner web y consumo movil.
- Publicar en VISO, consumir y ajustar puntualmente en ANIMA.

## Modelo de roles recomendado

## Problema actual

Un campo unico `employees.role` no alcanza para casos como:

- gerente en una sede
- chef o lider operativo en otra
- apoyo parcial a otra sede sin el mismo nivel de permiso

## Modelo recomendado

Una persona debe poder tener multiples asignaciones por sede.

### Base recomendada

- `employees`
  - identidad global del trabajador
  - datos personales
  - rol principal visible opcional solo como fallback

- `employee_sites`
  - relacion del empleado con cada sede
  - sede principal
  - activa/inactiva

### Evolucion necesaria

Agregar a la asignacion por sede:

- `role_code`
- `is_primary_role`
- `can_manage_team`
- `can_manage_shifts`
- `can_view_site_week`

La forma mas limpia a futuro es:

- o enriquecer `employee_sites`
- o crear `employee_site_roles`

## Recomendacion pragmatica

Para no romper demasiado pronto:

1. Mantener `employees.role` como fallback global temporal.
2. Empezar a mover permisos reales a nivel sede.
3. Resolver UI y permisos de turnos usando la asignacion por sede, no solo el rol global.

## Caso ejemplo

Persona:

- en `Vento Cafe`: `gerente`
- en `Saudo`: `chef`
- con permiso de ayudar a planificar en ambas, pero principalmente en `Vento Cafe`

Se modelaria asi:

- una sola fila en `employees`
- dos asignaciones activas de sede
- cada asignacion con su `role_code`
- permisos de planificacion por sede
- una sede primaria para contexto por defecto

Entonces:

- en `ANIMA`, la vista por defecto usa su sede principal
- puede cambiar de sede si tiene alcance multi-sede
- las acciones de turnos se filtran por capacidades del contexto de sede actual

## Reglas de acceso recomendadas

- `propietario`: alcance global
- `gerente_general`: alcance global
- `gerente`: alcance de sus sedes asignadas con permiso de gestion
- `chef` u otros lideres operativos: solo sedes donde tengan capacidad explicita

## Implicacion tecnica

No conviene seguir tomando todas las decisiones solo con:

- `employee.role`
- `employee.siteId`

Hay que evolucionar a:

- contexto de sede actual
- capacidades por sede
- rol efectivo por sede

## Implementacion iniciada en esta fase

- hacer visible `Turnos` en tabs
- agregar semana personal
- agregar semana de sede para managers

Lo siguiente despues de eso:

- retirar descansos del flujo visible
- limpiar home
- empezar migracion de permisos hacia rol/capacidad por sede
