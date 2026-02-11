-- Sede solo para la cuenta de revisión (Apple/Google).
-- Sin coordenadas = la app muestra "Esta sede no requiere GPS" y permite check-in desde cualquier lugar.
-- type = 'vento_group' = el trigger de asistencia NO valida distancia (backend acepta desde cualquier lugar).
-- No requiere nuevo build: solo ejecutar en Supabase SQL Editor.
--
-- Cuenta afectada: test@ventogroup.com (App Review)

DO $$
DECLARE
  review_email TEXT := 'test@ventogroup.com';
  review_user_id UUID;
  review_site_id UUID;
  review_site_name TEXT := 'App Review (Demo)';
BEGIN
  -- 1. Obtener ID del usuario de revisión
  SELECT id INTO review_user_id
  FROM auth.users
  WHERE email = review_email;

  IF review_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario % no encontrado en auth.users. Ejecuta primero 2026-01-28_create_test_account.sql o crea el usuario en Auth.', review_email;
  END IF;

  -- 2. Obtener o crear la sede de revisión (sin coordenadas + type vento_group)
  -- La app trata sedes sin lat/lon como "no requiere GPS". El trigger ignora geo cuando type = 'vento_group'.
  SELECT id INTO review_site_id
  FROM public.sites
  WHERE name = review_site_name
  LIMIT 1;

  IF review_site_id IS NULL THEN
    -- Según schema: sites tiene code (NOT NULL), name, type, site_type, site_kind (NOT NULL), sin updated_at
    INSERT INTO public.sites (
      code,
      name,
      type,
      site_type,
      site_kind,
      latitude,
      longitude,
      checkin_radius_meters,
      is_active,
      created_at
    )
    VALUES (
      'APP-REVIEW',
      review_site_name,
      'vento_group',
      'admin'::public.site_type,
      'demo',
      NULL,
      NULL,
      NULL,
      true,
      now()
    )
    RETURNING id INTO review_site_id;
  END IF;

  IF review_site_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo crear la sede "%". Revisa que la tabla sites tenga columnas type y site_type.', review_site_name;
  END IF;

  -- 3. Asignar esta sede al empleado de revisión (employees.site_id)
  UPDATE public.employees
  SET site_id = review_site_id, updated_at = now()
  WHERE id = review_user_id;

  -- 4. Dejar solo esta sede en employee_sites para el revisor (quitar Cúcuta y demás)
  DELETE FROM public.employee_sites
  WHERE employee_id = review_user_id;

  INSERT INTO public.employee_sites (employee_id, site_id, is_primary, is_active)
  VALUES (review_user_id, review_site_id, true, true)
  ON CONFLICT (employee_id, site_id) DO UPDATE SET
    is_primary = true,
    is_active = true;

  RAISE NOTICE 'Sede de revisión configurada.';
  RAISE NOTICE '  Sede: % (id: %)', review_site_name, review_site_id;
  RAISE NOTICE '  Usuario: % (id: %)', review_email, review_user_id;
  RAISE NOTICE '  La cuenta de revisión puede hacer check-in/check-out desde cualquier ubicación.';
END $$;
