# shift-publish-notify

Envía push al empleado cuando se publica o actualiza un turno. Se invoca desde el **trigger** de BD (ANIMA y VISO); opcionalmente con JWT de manager desde el cliente.

## Activación (una vez por proyecto)

1. **Migración aplicada**: el trigger y las claves en `app_config` ya están creados.
2. **URL de la función**: en la BD ejecutar:
   ```sql
   update app_config set value = '"https://TU_PROJECT_REF.supabase.co/functions/v1/shift-publish-notify"'::jsonb where key = 'shift_notify_function_url';
   ```
   (sustituir `TU_PROJECT_REF` por el id del proyecto Supabase).
3. **Secreto interno**: en el Dashboard de Supabase → Edge Functions → shift-publish-notify → Secrets, añadir:
   - Nombre: `INTERNAL_NOTIFY_SECRET`
   - Valor: el mismo que en BD para `shift_notify_internal_secret`:
   ```sql
   select value #>> '{}' from app_config where key = 'shift_notify_internal_secret';
   ```

A partir de ahí, cada INSERT/UPDATE en `employee_shifts` con `published_at` no nulo dispara la notificación (sin tocar VISO ni la app).
