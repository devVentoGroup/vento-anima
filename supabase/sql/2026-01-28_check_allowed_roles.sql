-- Script de diagnóstico: Ver qué roles están permitidos para cada tipo de sitio
-- Ejecuta esto PRIMERO para saber qué rol usar

-- 1. Ver qué roles están permitidos para cada tipo de sitio
SELECT 
  site_type,
  role,
  is_allowed
FROM role_site_type_rules
WHERE is_allowed = true
ORDER BY site_type, 
  CASE role
    WHEN 'owner' THEN 1
    WHEN 'manager' THEN 2
    WHEN 'warehouse' THEN 3
    WHEN 'logistics' THEN 4
    WHEN 'staff' THEN 5
    WHEN 'cashier' THEN 6
    WHEN 'waiter' THEN 7
    WHEN 'barista' THEN 8
    WHEN 'cook' THEN 9
    WHEN 'chef' THEN 10
    WHEN 'baker' THEN 11
    WHEN 'pastry' THEN 12
    ELSE 99
  END;

-- 2. Ver todos los sitios disponibles y sus tipos
SELECT 
  id,
  name,
  site_type,
  is_active
FROM sites
WHERE is_active = true
ORDER BY site_type, name;
