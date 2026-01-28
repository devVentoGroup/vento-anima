-- Prevent RLS recursion when helper functions read employees/employee_sites

create or replace function public.current_employee_primary_site_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (
      select es.site_id
      from public.employee_sites es
      where es.employee_id = auth.uid()
        and es.is_primary = true
      limit 1
    ),
    (
      select e.site_id
      from public.employees e
      where e.id = auth.uid()
    )
  );
$$;

create or replace function public.current_employee_role()
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select e.role
  from public.employees e
  where e.id = auth.uid();
$$;

create or replace function public.current_employee_selected_area_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (
      select s.selected_area_id
      from public.employee_settings s
      where s.employee_id = auth.uid()
    ),
    (
      select ea.area_id
      from public.employee_areas ea
      where ea.employee_id = auth.uid()
        and ea.is_primary = true
      limit 1
    ),
    (
      select e.area_id
      from public.employees e
      where e.id = auth.uid()
    )
  );
$$;

create or replace function public.current_employee_selected_site_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (
      select s.selected_site_id
      from public.employee_settings s
      where s.employee_id = auth.uid()
    ),
    public.current_employee_primary_site_id()
  );
$$;

create or replace function public.current_employee_site_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.current_employee_selected_site_id();
$$;

create or replace function public.current_employee_area_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.current_employee_selected_area_id();
$$;

create or replace function public.is_employee()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = auth.uid()
      and coalesce(e.is_active, true) = true
  );
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.is_employee();
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.current_employee_role() = 'propietario';
$$;

create or replace function public.is_global_manager()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.current_employee_role() = 'gerente_general';
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.current_employee_role() = 'gerente';
$$;

create or replace function public.is_manager_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.current_employee_role() in ('propietario', 'gerente', 'gerente_general');
$$;
