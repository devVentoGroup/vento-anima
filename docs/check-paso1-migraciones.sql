-- ============================================================
-- PASO 1: Comprobar si las migraciones del carnet laboral están aplicadas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Proyecto: el de ANIMA
-- ============================================================

SELECT
  'document_types.system_key' AS objeto,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_types' AND column_name = 'system_key'
  ) AS aplicado
UNION ALL
SELECT
  'required_document_rules (tabla)',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'required_document_rules')
UNION ALL
SELECT
  'employee_wallet_cards (tabla)',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_wallet_cards')
UNION ALL
SELECT
  'employee_wallet_eligibility (RPC)',
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'employee_wallet_eligibility'
  )
UNION ALL
SELECT
  'employee_wallet_mark_issued (RPC)',
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'employee_wallet_mark_issued'
  )
UNION ALL
SELECT
  'employee_wallet_sync_eligibility (RPC)',
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'employee_wallet_sync_eligibility'
  )
UNION ALL
SELECT
  'Contrato laboral (system_key)',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'document_types' AND column_name = 'system_key'
    )
    THEN EXISTS (SELECT 1 FROM public.document_types WHERE system_key = 'employment_contract')
    ELSE false
  END;
