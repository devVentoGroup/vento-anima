-- ANIMA Fase 1
-- 1) Descansos de turno con RPC start/end
-- 2) Bloquear DELETE directo de employees por cliente autenticado

create table if not exists public.attendance_breaks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  start_source text not null default 'mobile',
  end_source text null,
  start_notes text null,
  end_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_breaks_time_check check (ended_at is null or ended_at >= started_at),
  constraint attendance_breaks_start_source_check check (
    start_source = any (array['mobile'::text, 'web'::text, 'kiosk'::text, 'system'::text])
  ),
  constraint attendance_breaks_end_source_check check (
    end_source is null
    or end_source = any (array['mobile'::text, 'web'::text, 'kiosk'::text, 'system'::text])
  )
);

create index if not exists attendance_breaks_employee_started_idx
  on public.attendance_breaks (employee_id, started_at desc);

create index if not exists attendance_breaks_site_started_idx
  on public.attendance_breaks (site_id, started_at desc);

create unique index if not exists attendance_breaks_one_open_per_employee_idx
  on public.attendance_breaks (employee_id)
  where ended_at is null;

drop trigger if exists attendance_breaks_set_updated_at on public.attendance_breaks;
create trigger attendance_breaks_set_updated_at
before update on public.attendance_breaks
for each row execute function public.set_updated_at();

alter table public.attendance_breaks enable row level security;

drop policy if exists attendance_breaks_select_self on public.attendance_breaks;
create policy attendance_breaks_select_self
  on public.attendance_breaks
  for select
  to authenticated
  using (employee_id = auth.uid());

drop policy if exists attendance_breaks_select_manager on public.attendance_breaks;
create policy attendance_breaks_select_manager
  on public.attendance_breaks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.employees e
      where e.id = auth.uid()
        and e.role = any (array['propietario'::text, 'gerente'::text, 'gerente_general'::text])
        and (
          e.role = any (array['propietario'::text, 'gerente_general'::text])
          or e.site_id = attendance_breaks.site_id
        )
    )
  );

create or replace function public.start_attendance_break(
  p_site_id uuid,
  p_source text default 'mobile',
  p_notes text default null
)
returns public.attendance_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_last_action text;
  v_last_site_id uuid;
  v_result public.attendance_breaks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select *
    into v_employee
  from public.employees
  where id = auth.uid();

  if not found then
    raise exception 'Empleado no encontrado';
  end if;

  if coalesce(v_employee.is_active, false) is false then
    raise exception 'Empleado inactivo';
  end if;

  select action, site_id
    into v_last_action, v_last_site_id
  from public.attendance_logs
  where employee_id = v_employee.id
  order by occurred_at desc, created_at desc
  limit 1;

  if v_last_action is distinct from 'check_in' then
    raise exception 'No hay un turno activo para iniciar descanso';
  end if;

  if p_site_id is not null and p_site_id is distinct from v_last_site_id then
    raise exception 'La sede del descanso no coincide con el turno activo';
  end if;

  if exists (
    select 1
    from public.attendance_breaks b
    where b.employee_id = v_employee.id
      and b.ended_at is null
  ) then
    raise exception 'Ya tienes un descanso activo';
  end if;

  insert into public.attendance_breaks (
    employee_id,
    site_id,
    started_at,
    start_source,
    start_notes
  )
  values (
    v_employee.id,
    coalesce(p_site_id, v_last_site_id),
    now(),
    coalesce(p_source, 'mobile'),
    p_notes
  )
  returning *
    into v_result;

  return v_result;
end;
$$;

create or replace function public.end_attendance_break(
  p_source text default 'mobile',
  p_notes text default null
)
returns public.attendance_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_open_break public.attendance_breaks%rowtype;
  v_result public.attendance_breaks%rowtype;
begin
  v_employee_id := auth.uid();
  if v_employee_id is null then
    raise exception 'No autenticado';
  end if;

  select *
    into v_open_break
  from public.attendance_breaks
  where employee_id = v_employee_id
    and ended_at is null
  order by started_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No hay descanso activo para finalizar';
  end if;

  update public.attendance_breaks
  set
    ended_at = now(),
    end_source = coalesce(p_source, 'mobile'),
    end_notes = p_notes
  where id = v_open_break.id
  returning *
    into v_result;

  return v_result;
end;
$$;

grant execute on function public.start_attendance_break(uuid, text, text) to authenticated;
grant execute on function public.end_attendance_break(text, text) to authenticated;

-- Bloqueo de borrado directo en employees:
-- Antes: employees_write_owner aplicaba tambien a DELETE (sin FOR).
-- Ahora: solo se permite INSERT para owner/global manager, y DELETE queda sin politica.
drop policy if exists employees_write_owner on public.employees;

drop policy if exists employees_insert_owner_global_manager on public.employees;
create policy employees_insert_owner_global_manager
  on public.employees
  for insert
  to authenticated
  with check (
    public.is_owner()
    or (
      public.is_global_manager()
      and role <> all (array['propietario'::text, 'gerente_general'::text])
    )
  );
