-- Script para crear cuenta de prueba para revisión de Google Play
-- Ejecutar en Supabase SQL Editor

-- CONFIGURACIÓN (cambia estos valores según necesites)
DO $$
DECLARE
  test_email TEXT := 'play-review@vento-anima.test';
  test_password TEXT := 'PlayReview2026!';
  test_full_name TEXT := 'Google Play Reviewer';
  test_role TEXT; -- Se determinará consultando las reglas reales
  test_site_id UUID; -- Se obtendrá automáticamente del primer sitio disponible
  test_site_type public.site_type; -- Tipo enum para site_type
  new_user_id UUID;
  allowed_role TEXT;
BEGIN
  -- 1. Obtener el sitio "Vento Group" (admin) primero, o el primer disponible
  SELECT id, site_type INTO test_site_id, test_site_type
  FROM sites 
  WHERE is_active = true 
    AND (name = 'Vento Group' OR site_type IN ('admin', 'production_center', 'satellite'))
  ORDER BY CASE 
    WHEN name = 'Vento Group' THEN 1
    WHEN site_type = 'admin' THEN 2
    WHEN site_type = 'production_center' THEN 3
    WHEN site_type = 'satellite' THEN 4
  END
  LIMIT 1;
  
  IF test_site_id IS NULL THEN
    RAISE EXCEPTION 'No hay sitios activos disponibles. Crea un sitio primero.';
  END IF;
  
  -- 2. Consultar qué roles están permitidos para este tipo de sitio desde role_site_type_rules
  -- Usando los roles reales en español
  SELECT role INTO allowed_role
  FROM role_site_type_rules
  WHERE site_type = test_site_type
    AND is_allowed = true
  ORDER BY CASE role
    WHEN 'propietario' THEN 1
    WHEN 'gerente_general' THEN 2
    WHEN 'gerente' THEN 3
    WHEN 'marketing' THEN 4
    WHEN 'contador' THEN 5
    WHEN 'bodeguero' THEN 6
    WHEN 'cocinero' THEN 7
    WHEN 'barista' THEN 8
    WHEN 'mesero' THEN 9
    WHEN 'cajero' THEN 10
    WHEN 'conductor' THEN 11
    WHEN 'panadero' THEN 12
    WHEN 'repostero' THEN 13
    WHEN 'pastelero' THEN 14
    ELSE 99
  END
  LIMIT 1;
  
  -- Si no se encuentra ningún rol permitido, mostrar error con información útil
  IF allowed_role IS NULL THEN
    RAISE EXCEPTION 'No se encontraron roles permitidos para site_type="%". Ejecuta el script 2026-01-28_check_allowed_roles.sql para ver los roles disponibles.', test_site_type;
  END IF;
  
  test_role := allowed_role;
  
  RAISE NOTICE 'Sitio seleccionado: % (tipo: %), usando rol: %', test_site_id, test_site_type, test_role;
  
  -- 2. Crear usuario en Supabase Auth
  -- Nota: Esto debe hacerse desde el Dashboard de Supabase o usando la API de Admin
  -- Por ahora, creamos el registro en employees y employee_sites
  -- El usuario debe crearse manualmente desde Auth > Users en el Dashboard
  
  -- 3. Obtener el ID del usuario si ya existe (por si ya lo creaste manualmente)
  SELECT id INTO new_user_id
  FROM auth.users
  WHERE email = test_email;
  
  IF new_user_id IS NULL THEN
    RAISE NOTICE 'IMPORTANTE: Primero crea el usuario en Supabase Dashboard:';
    RAISE NOTICE '1. Ve a Authentication > Users';
    RAISE NOTICE '2. Haz clic en "Add user" > "Create new user"';
    RAISE NOTICE '3. Email: %', test_email;
    RAISE NOTICE '4. Password: %', test_password;
    RAISE NOTICE '5. Auto Confirm User: Sí';
    RAISE NOTICE '6. Después de crear el usuario, ejecuta la parte 2 de este script';
    RAISE EXCEPTION 'Usuario no encontrado. Crea el usuario primero en Auth Dashboard.';
  END IF;
  
  -- 4. Crear registro en employees
  INSERT INTO employees (
    id,
    full_name,
    role,
    site_id,
    is_active,
    joined_at,
    updated_at
  ) VALUES (
    new_user_id,
    test_full_name,
    test_role,
    test_site_id,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    site_id = EXCLUDED.site_id,
    is_active = true,
    updated_at = NOW();
  
  -- 5. Crear registro en employee_sites
  INSERT INTO employee_sites (
    employee_id,
    site_id,
    is_primary,
    is_active
  ) VALUES (
    new_user_id,
    test_site_id,
    true,
    true
  )
  ON CONFLICT (employee_id, site_id) DO UPDATE SET
    is_primary = true,
    is_active = true;
  
  RAISE NOTICE '✅ Cuenta de prueba creada exitosamente!';
  RAISE NOTICE 'Email: %', test_email;
  RAISE NOTICE 'Password: %', test_password;
  RAISE NOTICE 'User ID: %', new_user_id;
  RAISE NOTICE 'Site ID: %', test_site_id;
  
END $$;
