# Configuración de turnos (recordatorio y cierre) sin nueva build

El recordatorio de cierre de turno (“Tu turno está por cerrar”) y el cierre automático **no dependen del código de la app**. Los controla la **Edge Function** `shift-runtime-processor`, que lee la tabla **`shift_policy`**. Puedes cambiar el comportamiento solo con cambios en la base de datos (y, si hace falta, redespliegue de la función).

## Aviso “X minutos antes” de la hora de salida

El aviso principal es **X minutos antes** de la hora programada de salida. Eso se controla con **`end_reminder_minutes_before_end`** en `shift_policy` (por defecto 5). Para que sea 10 minutos antes, basta con:

```sql
update shift_policy set end_reminder_minutes_before_end = 10 where id = 1;
```

No hace falta nueva build: la función lee ese valor cada vez que corre el cron (cada 5 min).

## Si no te llegó el aviso (diagnóstico desde la BD)

Cuando el aviso “X min antes” no llega, revisar en este orden:

1. **Que exista fila y esté activado el recordatorio**
   - `select id, end_reminder_enabled, end_reminder_minutes_before_end from shift_policy where id = 1;`
   - Debe haber una fila con `end_reminder_enabled = true`. Si no hay fila, crear/insertar una con esos valores.

2. **Minutos antes**
   - `end_reminder_minutes_before_end` debe ser 5 o 10 (o el valor que quieras). Si está en 0, el aviso se envía justo en la hora de salida.

3. **Token de push del empleado**
   - `select employee_id, token, is_active from employee_push_tokens where employee_id = '<tu_employee_id>';`
   - Tiene que haber al menos un token con `is_active = true`. Si no hay token, la app no puede recibir el push (revisar que en el dispositivo estén permitidas las notificaciones y que la app haya registrado el token).

4. **Cron activo**
   - El job que llama a la Edge Function debe ejecutarse cada 5 minutos (Supabase cron o equivalente). Si el cron no corre, no se envía ningún aviso.

5. **Qué pasó en ese turno**
   - `select * from shift_runtime_events where shift_id = '<shift_id>' and event_type = 'end_reminder_sent';`
   - Si aparece una fila con `status = 'applied'`, el sistema sí intentó enviar (revisar entonces token/notificaciones en el dispositivo). Si `status = 'skipped'` y `notes = 'no_active_tokens'`, el empleado no tenía token activo en ese momento.

6. **Zona horaria**
   - La función usa `America/Bogota` por defecto (o la env `SHIFT_RUNTIME_TIME_ZONE`). La “hora de salida” del turno se interpreta en esa zona; si el servidor o el cron usan otra hora, la ventana puede no coincidir.

## Tabla `shift_policy`

- **`end_reminder_enabled`** (boolean): si está en `true`, se envía el push “Tu turno está por cerrar” cuando corresponde.
- **`end_reminder_minutes_before_end`** (int): minutos **antes** de la hora de salida en que empieza la ventana del recordatorio (por defecto 5).
- **`end_reminder_minutes_after_end`** (int, opcional): minutos **después** de la hora de salida en que aún se puede enviar el recordatorio. Si es `null`, se usa la misma ventana que el autocierre (`auto_checkout_grace_minutes_after_end`). Ejemplo: 15 → recordatorio hasta 15 min después de la hora de salida.
- **`auto_checkout_grace_minutes_after_end`** (int): minutos después de la hora de salida en que se hace el cierre automático (por defecto 30).
- **`scheduled_auto_checkout_enabled`** (boolean): si está en `true`, se ejecuta el cierre automático cuando se pasa la ventana de gracia.

## Cómo asegurar que el recordatorio llegue

1. **Que exista una fila en `shift_policy`** (normalmente `id = 1`).
2. **`end_reminder_enabled = true`**.
3. Opcional: aumentar **`end_reminder_minutes_before_end`** (ej. 10) para avisar antes, y **`end_reminder_minutes_after_end`** (ej. 15) para seguir enviando el recordatorio unos minutos después de la hora de salida (útil si el cron corre cada 5 min y se te pasó la hora).
4. El empleado debe tener al menos un token activo en **`employee_push_tokens`** (la app registra el token al permitir notificaciones).
5. El **cron** que llama a la Edge Function debe estar activo (cada 5 minutos); ver migración `20260314183000_anima_shift_runtime_processor_cron.sql`.

## Ejemplos de ajuste solo en BD (sin nueva build)

- **Aviso 10 minutos antes de la hora de salida:**  
  `update shift_policy set end_reminder_minutes_before_end = 10 where id = 1;`
- **Aviso 5 minutos antes** (valor por defecto):  
  `update shift_policy set end_reminder_minutes_before_end = 5 where id = 1;`
- Activar recordatorio (por si estaba en false):  
  `update shift_policy set end_reminder_enabled = true where id = 1;`
- Recordatorio hasta 15 min después de la hora de salida (por si se pasó la hora):  
  `update shift_policy set end_reminder_minutes_after_end = 15 where id = 1;`

Todo esto se aplica sin nueva build: la Edge Function lee `shift_policy` en cada ejecución.
