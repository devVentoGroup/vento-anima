-- Definitive fix for employees RLS recursion
-- 1) Make auth helpers bypass RLS safely
-- 2) Remove self-referencing subqueries in employees policies

create or replace function public.can_access_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    case
      when p_site_id is null then false
      when is_owner() then true
      when is_global_manager() then true
      when exists (
        select 1
        from public.employee_sites es
        where es.employee_id = auth.uid()
          and es.site_id = p_site_id
          and es.is_active = true
      ) then true
      when exists (
        select 1
        from public.employees e
        where e.id = auth.uid()
          and e.site_id = p_site_id
          and (e.is_active is true or e.is_active is null)
      ) then true
      else false
    end;
$$;

create or replace function public.can_access_area(p_area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select p_area_id is null
    or public.is_owner()
    or public.is_global_manager()
    or exists (
      select 1
      from public.employee_areas ea
      join public.areas a on a.id = ea.area_id
      where ea.employee_id = auth.uid()
        and ea.area_id = p_area_id
        and coalesce(ea.is_active, true) = true
        and a.site_id = public.current_employee_selected_site_id()
    )
    or exists (
      select 1
      from public.employees e
      where e.id = auth.uid()
        and e.area_id = p_area_id
    );
$$;

-- Employees policies (drop + recreate without self-joins)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employees'
      AND policyname = 'employees_select'
  ) THEN
    EXECUTE 'DROP POLICY employees_select ON public.employees';
  END IF;

  EXECUTE $sql$
    CREATE POLICY employees_select
    ON public.employees
    FOR SELECT
    USING (
      auth.role() = 'authenticated'
      AND (
        public.is_owner()
        OR public.is_global_manager()
        OR (
          public.current_employee_role() = 'gerente'
          AND site_id = public.current_employee_site_id()
        )
        OR id = auth.uid()
      )
    );
  $sql$;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employees'
      AND policyname = 'employees_select_manager'
  ) THEN
    EXECUTE 'DROP POLICY employees_select_manager ON public.employees';
  END IF;

  EXECUTE $sql$
    CREATE POLICY employees_select_manager
    ON public.employees
    FOR SELECT
    USING (
      auth.role() = 'authenticated'
      AND (
        public.is_owner()
        OR public.is_global_manager()
        OR (
          public.current_employee_role() = 'gerente'
          AND site_id = public.current_employee_site_id()
        )
        OR (
          public.current_employee_role() = 'bodeguero'
          AND public.can_access_site(site_id)
        )
      )
    );
  $sql$;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employees'
      AND policyname = 'employees_select_area'
  ) THEN
    EXECUTE 'DROP POLICY employees_select_area ON public.employees';
  END IF;

  EXECUTE $sql$
    CREATE POLICY employees_select_area
    ON public.employees
    FOR SELECT
    USING (
      (area_id IS NOT NULL)
      AND public.can_access_area(area_id)
      AND (
        public.is_owner()
        OR public.is_global_manager()
        OR public.current_employee_role() <> 'gerente'
        OR site_id = public.current_employee_site_id()
      )
    );
  $sql$;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employees'
      AND policyname = 'employees_update'
  ) THEN
    EXECUTE 'DROP POLICY employees_update ON public.employees';
  END IF;

  EXECUTE $sql$
    CREATE POLICY employees_update
    ON public.employees
    FOR UPDATE
    USING (
      public.is_owner()
      OR public.is_global_manager()
      OR (
        public.current_employee_role() = 'gerente'
        AND site_id = public.current_employee_site_id()
      )
      OR id = auth.uid()
    )
    WITH CHECK (
      public.is_owner()
      OR (
        public.is_global_manager()
        AND role NOT IN ('propietario', 'gerente_general')
      )
      OR (
        public.current_employee_role() = 'gerente'
        AND role NOT IN ('propietario', 'gerente_general', 'gerente')
        AND site_id = public.current_employee_site_id()
      )
      OR (
        id = auth.uid()
        AND role = public.current_employee_role()
      )
    );
  $sql$;
END $$;
