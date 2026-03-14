# ANIMA - Invitaciones Pendientes y Reenvio

> Diseno tecnico para bajar la Fase 1 del roadmap a modelo de datos, backend y UI.
> Fecha: 2026-03-13.
> Estado: propuesta.

---

## 0. Objetivo

Resolver el vacio actual del modulo Equipo:

- hoy se puede invitar a un trabajador
- hoy se puede agregar al equipo a un usuario ya existente en Auth
- hoy no existe una representacion formal de invitaciones pendientes
- hoy no existe un reenvio seguro y trazable

La meta es que ANIMA tenga una bandeja operativa de invitaciones y que el flujo sea entendible para managers sin revisar Supabase manualmente.

---

## 1. Estado actual

### 1.1 Flujo vigente

#### `staff-invitations-create`
Comportamiento actual:
- valida que quien invita tenga rol de gestion
- valida rol y sede destino
- genera link tipo `invite` usando `supabase.auth.admin.generateLink`
- si el correo ya existe en Auth:
  - no envia correo de invitacion
  - intenta vincular ese usuario a `employees` y `employee_sites`
  - devuelve exito como agregado al equipo

#### `staff-invitations-accept`
Comportamiento actual:
- toma el usuario autenticado por el token del enlace
- actualiza password y metadata
- crea o actualiza `employees`
- crea o actualiza `employee_sites`

#### `team.tsx`
Comportamiento actual:
- permite invitar desde modal
- muestra mensaje de exito
- no lista pendientes
- no permite reenviar
- no muestra historico de estados

### 1.2 Problemas del flujo actual

1. La invitacion no tiene una entidad propia persistida en BD.
2. No se puede distinguir claramente entre:
   - invitacion enviada y no aceptada
   - usuario ya existente agregado al equipo
   - invitacion vencida
   - invitacion reenviada
3. No existe una bandeja operativa para managers.
4. No existe auditoria simple de cuantas veces se envio o reenvio.
5. El estado del acceso queda repartido entre Auth, metadata, `employees` y mensajes efimeros de UI.

---

## 2. Decision de producto

### 2.1 Regla principal
Toda invitacion laboral debe quedar persistida en una tabla de dominio, aunque el resultado final sea:

- correo enviado
- usuario agregado directamente al equipo
- invitacion aceptada
- invitacion vencida
- invitacion cancelada

### 2.2 Casos a soportar

#### Caso A. Correo nuevo
- se crea invitacion
- se genera enlace
- se envia correo
- queda estado `sent`
- cuando acepta, pasa a `accepted`

#### Caso B. Correo ya existente en Auth
- no se envia correo de invitacion si el flujo decide agregar directo
- igual queda registro persistido
- estado sugerido: `linked_existing_user`
- si el usuario no tiene password para ANIMA, la UI debe explicarlo

#### Caso C. Invitacion reenviada
- no se crea empleado nuevo
- se registra nuevo intento de envio
- aumenta contador de reenvio
- se actualiza `last_sent_at`

#### Caso D. Invitacion expirada
- no se reutiliza silenciosamente si ya expiro
- el manager puede reenviar, lo que genera un nuevo enlace
- el estado pasa temporalmente por `resent`

#### Caso E. Cancelacion manual
- opcional para MVP
- si se implementa, marca estado `cancelled`
- no borra historico

---

## 3. Modelo de datos propuesto

## 3.1 Tabla principal

Tabla sugerida:
- temporal si hace falta: `public.staff_invitations`
- destino correcto: `anima.staff_invitations`

### Campos sugeridos

- [ ] `id uuid primary key default gen_random_uuid()`
- [ ] `email text not null`
- [ ] `full_name text null`
- [ ] `role_code text not null`
- [ ] `site_id uuid not null`
- [ ] `status text not null`
- [ ] `auth_user_id uuid null`
- [ ] `employee_id uuid null`
- [ ] `invited_by uuid not null`
- [ ] `invited_at timestamptz not null default now()`
- [ ] `last_sent_at timestamptz null`
- [ ] `accepted_at timestamptz null`
- [ ] `expired_at timestamptz null`
- [ ] `cancelled_at timestamptz null`
- [ ] `resend_count integer not null default 0`
- [ ] `delivery_channel text not null default 'email'`
- [ ] `invite_token_hash text null`
- [ ] `source_app text not null default 'anima'`
- [ ] `notes text null`
- [ ] `metadata jsonb not null default '{}'::jsonb`
- [ ] `created_at timestamptz not null default now()`
- [ ] `updated_at timestamptz not null default now()`

### Indices sugeridos

- [ ] index por `email`
- [ ] index por `status`
- [ ] index por `site_id`
- [ ] index por `invited_by`
- [ ] index por `auth_user_id`
- [ ] index compuesto por `email, status`

---

## 3.2 Estados sugeridos

Estados recomendados para MVP:

- `draft`
  Solo si en algun momento hay preparacion previa sin envio. No necesario para primera version.

- `sent`
  Invitacion enviada por correo y pendiente de aceptacion.

- `linked_existing_user`
  El correo ya existia en Auth y se agrego al equipo sin correo de invitacion.

- `accepted`
  El usuario completo el flujo y quedo activo en ANIMA.

- `expired`
  El enlace ya no debe considerarse valido para uso operativo.

- `cancelled`
  Invitacion anulada manualmente.

- `failed`
  Fallo tecnico de envio o persistencia.

### Estado derivado opcional de UI

La UI puede mostrar etiquetas amigables a partir del estado base:

- Pendiente
- Agregado al equipo
- Aceptada
- Vencida
- Cancelada
- Fallida

---

## 3.3 Eventos de auditoria opcionales

Si queremos trazabilidad mas limpia sin sobrecargar la tabla principal:

Tabla sugerida:
- `anima.staff_invitation_events`

Campos:
- [ ] `id`
- [ ] `staff_invitation_id`
- [ ] `event_type`
- [ ] `actor_user_id`
- [ ] `payload jsonb`
- [ ] `created_at`

Eventos utiles:
- `created`
- `sent`
- `resent`
- `linked_existing_user`
- `accepted`
- `expired`
- `cancelled`
- `delivery_failed`

Para MVP, esto puede esperar. Si el tiempo es corto, basta con la tabla principal.

---

## 4. Reglas de negocio

### 4.1 Regla de unicidad operativa
No debe existir mas de una invitacion activa por combinacion:
- `email`
- `site_id`
- `status` en conjunto activo

Conjunto activo sugerido:
- `sent`
- `linked_existing_user` solo si aun no se ha materializado en empleado util

### 4.2 Regla de reenvio
Reenviar no crea un empleado ni cambia rol/sede por si solo.
Reenviar solo:
- genera nuevo link si aplica
- aumenta `resend_count`
- actualiza `last_sent_at`
- registra evento

### 4.3 Regla para usuario existente en Auth
Si el usuario ya existe en Auth:
- se intenta vincular a `employees` / `employee_sites`
- se persiste una fila de invitacion igual
- el estado queda en `linked_existing_user`
- la UI muestra mensaje especifico:
  - "Este usuario ya existia. Fue agregado al equipo. Si solo usa OTP en otra app, debe crear contrasena con 'Olvidaste tu contrasena'."

### 4.4 Regla de aceptacion
Cuando `staff-invitations-accept` termina bien:
- la invitacion asociada debe pasar a `accepted`
- se llena `accepted_at`
- se asocia `auth_user_id` y `employee_id` si faltaban

### 4.5 Regla de expiracion
La expiracion puede manejarse de dos maneras:

#### Opcion simple MVP
- guardar `expired_at`
- considerar vencida toda invitacion con `expired_at < now()` y `status = sent`
- al consultar, marcarla como vencida en UI o actualizarla en backend

#### Opcion robusta
- job o trigger que marque `expired`
- no necesario para primera version

---

## 5. Cambios requeridos en backend

## 5.1 `staff-invitations-create`

### Ajustes propuestos
- [ ] persistir fila en `staff_invitations` antes o durante el proceso
- [ ] si el envio por link funciona:
  - `status = sent`
  - `last_sent_at = now()`
  - `expired_at` segun politica
- [ ] si el usuario ya existia en Auth y se agrego al equipo:
  - `status = linked_existing_user`
  - persistir `auth_user_id` / `employee_id` cuando sea posible
- [ ] si hay error tecnico:
  - `status = failed`
  - guardar mensaje resumido en `metadata`

### Respuesta sugerida de la funcion
```json
{
  "ok": true,
  "invitation_id": "uuid",
  "status": "sent",
  "invited": true,
  "added_to_team": false,
  "message": "Invitacion enviada correctamente"
}
```

Para usuario existente:
```json
{
  "ok": true,
  "invitation_id": "uuid",
  "status": "linked_existing_user",
  "invited": false,
  "added_to_team": true,
  "message": "El usuario ya existia y fue agregado al equipo"
}
```

---

## 5.2 Nueva funcion `staff-invitations-resend`

### Responsabilidad
- validar permisos del actor
- recibir `staff_invitation_id`
- verificar que la invitacion exista y sea reenviable
- generar nuevo link si aplica
- enviar correo
- actualizar `last_sent_at` y `resend_count`

### Entradas sugeridas
```json
{
  "staff_invitation_id": "uuid"
}
```

### Reglas
- no reenviar invitaciones `accepted`
- no reenviar `cancelled`
- si `linked_existing_user`, no reenviar correo de invitacion tradicional
  - opcionalmente devolver mensaje guiando a password recovery

### Respuesta sugerida
```json
{
  "ok": true,
  "invitation_id": "uuid",
  "status": "sent",
  "resend_count": 2,
  "message": "Invitacion reenviada"
}
```

---

## 5.3 `staff-invitations-accept`

### Ajustes propuestos
- [ ] identificar la invitacion activa asociada al usuario o email
- [ ] actualizarla a `accepted`
- [ ] guardar `accepted_at`
- [ ] guardar `employee_id`
- [ ] guardar `auth_user_id`

### Estrategia de asociacion sugerida
Prioridad:
1. por `auth_user_id`
2. por email en estado `sent`
3. por email en estado `linked_existing_user` si aplica logica de cierre

---

## 6. Cambios de UI en `team.tsx`

## 6.1 Objetivo de UI
Que Equipo tenga dos capas:

### Capa 1. Equipo actual
Lista de empleados existentes.

### Capa 2. Invitaciones pendientes
Lista separada para estados operativos de acceso.

---

## 6.2 Cambios propuestos

### Nuevo bloque o seccion
- [ ] agregar seccion `Invitaciones pendientes`
- [ ] mostrar contador
- [ ] permitir filtrar por estado si luego hace falta

### Datos por fila sugeridos
- email
- nombre si existe
- rol
- sede
- estado
- fecha de envio
- ultimo envio
- numero de reenvios
- accion principal

### Acciones por estado

#### `sent`
- [ ] `Reenviar`
- [ ] `Cancelar` opcional

#### `linked_existing_user`
- [ ] `Ver detalle`
- [ ] `Copiar instruccion` o mensaje guiado

#### `expired`
- [ ] `Reenviar`

#### `accepted`
- normalmente no se muestra en pendientes

---

## 6.3 UX copy sugerido

### Invitacion enviada
- Titulo: `Invitacion enviada`
- Cuerpo: `Se envio un correo a {email}. Queda pendiente hasta que complete su acceso.`

### Usuario existente agregado
- Titulo: `Agregado al equipo`
- Cuerpo: `El correo ya existia en el sistema. Si esa persona solo entra con codigo en otra app, debe usar 'Olvidaste tu contrasena' en ANIMA.`

### Invitacion vencida
- Titulo: `Invitacion vencida`
- Cuerpo: `El enlace ya no esta vigente. Puedes reenviarlo para generar uno nuevo.`

---

## 7. Consulta sugerida para pendientes

Pendientes visibles en UI:
- `sent`
- `expired`
- `linked_existing_user` si todavia requiere seguimiento operativo

No visibles por defecto:
- `accepted`
- `cancelled`
- `failed` salvo en auditoria o vista avanzada

Consulta conceptual:
- traer invitaciones por sede segun permisos del manager
- ordenar por `updated_at desc`

---

## 8. Seguridad y permisos

### Managers
- solo pueden ver y reenviar invitaciones de su sede
- no pueden invitar roles de gestion

### Gerente general y propietario
- pueden ver todas las sedes
- pueden reenviar cualquier invitacion valida

### Recomendacion de RLS
Si la tabla se consulta desde app directa:
- crear policies por rol y sede

Si todo pasa por Edge Functions:
- la tabla puede quedar mas cerrada y exponer solo lecturas seguras necesarias

---

## 9. Estrategia de implementacion incremental

## Etapa 1. Persistencia sin cambiar mucho la UX
- [ ] crear tabla `staff_invitations`
- [ ] hacer que `staff-invitations-create` persista resultado
- [ ] actualizar `staff-invitations-accept` para cerrar invitacion
- [ ] mantener UI actual de invitacion

## Etapa 2. Bandeja de pendientes
- [ ] leer pendientes en `team.tsx`
- [ ] mostrar lista y estados
- [ ] sin reenvio aun, solo visibilidad

## Etapa 3. Reenvio
- [ ] crear `staff-invitations-resend`
- [ ] agregar boton `Reenviar`
- [ ] actualizar contador y timestamps

## Etapa 4. Pulido operativo
- [ ] cancelacion opcional
- [ ] filtros por estado
- [ ] auditoria de eventos si hace falta

---

## 10. Riesgos

- vincular mal invitaciones con usuarios ya existentes en Auth
- reenviar invitaciones ya aceptadas
- duplicar filas en `employees` o `employee_sites`
- mezclar demasiado rapido esta tabla con migracion de schema
- tratar igual los casos `sent` y `linked_existing_user` cuando operativamente no lo son

---

## 11. Recomendacion final

Para no romper lo actual, recomiendo este enfoque:

1. Crear `staff_invitations` primero en `public` si eso acelera el rollout.
2. Ajustar funciones existentes para escribir y cerrar la invitacion.
3. Agregar bandeja de pendientes en `team.tsx`.
4. Agregar `resend` como segunda entrega.
5. Cuando el dominio este estable, mover este modulo a `anima.staff_invitations` como parte de la migracion por capas.

---

## 12. Definition of Done

- [ ] Toda invitacion queda persistida.
- [ ] Existe un estado claro de acceso por cada caso.
- [ ] Equipo muestra pendientes reales.
- [ ] Reenvio funciona sin duplicar empleados.
- [ ] La aceptacion cierra correctamente la invitacion.
- [ ] El manager entiende el flujo sin revisar manualmente Auth o tablas internas.
