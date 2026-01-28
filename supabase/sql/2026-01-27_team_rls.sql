-- Team management RLS policies

alter table if exists public.employees enable row level security;
alter table if exists public.employee_sites enable row level security;
alter table if exists public.roles enable row level security;
alter table if exists public.sites enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and policyname = 'employees_select'
  ) then
    create policy employees_select
      on public.employees
      for select
      using (
        auth.role() = 'authenticated'
        and (
          public.is_owner()
          or public.is_global_manager()
          or (
            public.current_employee_role() = 'gerente'
            and employees.site_id = (
              select site_id from public.employees me where me.id = auth.uid()
            )
          )
          or id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and policyname = 'employees_update'
  ) then
    create policy employees_update
      on public.employees
      for update
      using (
        public.is_owner()
        or public.is_global_manager()
        or (
          public.current_employee_role() = 'gerente'
          and employees.site_id = (
            select site_id from public.employees me where me.id = auth.uid()
          )
        )
        or id = auth.uid()
      )
      with check (
        public.is_owner()
        or (
          public.is_global_manager()
          and role not in ('propietario', 'gerente_general')
        )
        or (
          public.current_employee_role() = 'gerente'
          and role not in ('propietario', 'gerente_general', 'gerente')
          and employees.site_id = (
            select site_id from public.employees me where me.id = auth.uid()
          )
        )
        or (
          id = auth.uid()
          and role = (select role from public.employees me where me.id = auth.uid())
        )
      );
  end if;
end $$;

-- Tighten existing policies to keep managers scoped to their own site
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and policyname = 'employees_select_manager'
  ) then
    execute $sql$
      alter policy employees_select_manager
      on public.employees
      using (
        auth.role() = 'authenticated'
        and (
          public.is_owner()
          or public.is_global_manager()
          or (
            public.current_employee_role() = 'gerente'
            and site_id = (
              select site_id from public.employees me where me.id = auth.uid()
            )
          )
          or (
            public.current_employee_role() = 'bodeguero'
            and can_access_site(site_id)
          )
        )
      );
    $sql$;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and policyname = 'employees_select_area'
  ) then
    execute $sql$
      alter policy employees_select_area
      on public.employees
      using (
        (area_id is not null)
        and can_access_area(area_id)
        and (
          public.is_owner()
          or public.is_global_manager()
          or public.current_employee_role() <> 'gerente'
          or site_id = (
            select site_id from public.employees me where me.id = auth.uid()
          )
        )
      );
    $sql$;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and policyname = 'employees_write_owner'
  ) then
    execute $sql$
      alter policy employees_write_owner
      on public.employees
      using (public.is_owner() or public.is_global_manager())
      with check (
        public.is_owner()
        or (
          public.is_global_manager()
          and role not in ('propietario', 'gerente_general')
        )
      );
    $sql$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_sites'
      and policyname = 'employee_sites_select'
  ) then
    create policy employee_sites_select
      on public.employee_sites
      for select
      using (
        auth.role() = 'authenticated'
        and (
          public.is_owner()
          or public.is_global_manager()
          or (
            public.current_employee_role() = 'gerente'
            and employee_id in (
              select id
              from public.employees e
              where e.site_id = (
                select site_id from public.employees me where me.id = auth.uid()
              )
            )
          )
          or employee_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_sites'
      and policyname = 'employee_sites_write_admin'
  ) then
    create policy employee_sites_write_admin
      on public.employee_sites
      for all
      using (
        public.is_owner()
        or public.is_global_manager()
      )
      with check (
        public.is_owner()
        or public.is_global_manager()
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'roles'
      and policyname = 'roles_select'
  ) then
    create policy roles_select
      on public.roles
      for select
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sites'
      and policyname = 'sites_select'
  ) then
    create policy sites_select
      on public.sites
      for select
      using (auth.role() = 'authenticated');
  end if;
end $$;
