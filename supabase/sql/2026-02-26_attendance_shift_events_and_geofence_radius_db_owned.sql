-- ANIMA
-- 1) Registrar eventos de turno (salida de sede sin cierre)
-- 2) Geocerca: usar radio definido por BD sin cap hardcodeado

create table if not exists public.attendance_shift_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  shift_start_at timestamptz not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  distance_meters integer null,
  accuracy_meters integer null,
  source text not null default 'mobile',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_shift_events_event_type_check check (
    event_type = any (array['left_site_open_shift'::text])
  ),
  constraint attendance_shift_events_source_check check (
    source = any (array['mobile'::text, 'web'::text, 'kiosk'::text, 'system'::text])
  ),
  constraint attendance_shift_events_distance_check check (
    distance_meters is null or distance_meters >= 0
  ),
  constraint attendance_shift_events_accuracy_check check (
    accuracy_meters is null or accuracy_meters >= 0
  )
);

create index if not exists attendance_shift_events_employee_shift_idx
  on public.attendance_shift_events (employee_id, shift_start_at desc);

create index if not exists attendance_shift_events_site_occurred_idx
  on public.attendance_shift_events (site_id, occurred_at desc);

create unique index if not exists attendance_shift_events_unique_shift_event_idx
  on public.attendance_shift_events (employee_id, shift_start_at, event_type);

drop trigger if exists attendance_shift_events_set_updated_at on public.attendance_shift_events;
create trigger attendance_shift_events_set_updated_at
before update on public.attendance_shift_events
for each row execute function public.set_updated_at();

alter table public.attendance_shift_events enable row level security;

drop policy if exists attendance_shift_events_select_self on public.attendance_shift_events;
create policy attendance_shift_events_select_self
  on public.attendance_shift_events
  for select
  to authenticated
  using (employee_id = auth.uid());

drop policy if exists attendance_shift_events_select_manager on public.attendance_shift_events;
create policy attendance_shift_events_select_manager
  on public.attendance_shift_events
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
          or e.site_id = attendance_shift_events.site_id
        )
    )
  );

create or replace function public.register_shift_departure_event(
  p_site_id uuid,
  p_distance_meters integer,
  p_accuracy_meters integer default null,
  p_source text default 'mobile',
  p_notes text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid := auth.uid();
  v_employee public.employees%rowtype;
  v_shift_site_id uuid;
  v_shift_start_at timestamptz;
  v_event_id uuid;
  v_distance integer := greatest(coalesce(p_distance_meters, 0), 0);
  v_accuracy integer := case
    when p_accuracy_meters is null then null
    else greatest(p_accuracy_meters, 0)
  end;
  v_event_time timestamptz := coalesce(p_occurred_at, now());
begin
  if v_employee_id is null then
    raise exception 'No autenticado';
  end if;

  select *
    into v_employee
  from public.employees
  where id = v_employee_id;

  if not found then
    raise exception 'Empleado no encontrado';
  end if;

  if coalesce(v_employee.is_active, false) is false then
    raise exception 'Empleado inactivo';
  end if;

  select al.site_id, al.occurred_at
    into v_shift_site_id, v_shift_start_at
  from public.attendance_logs al
  where al.employee_id = v_employee_id
    and al.action = 'check_in'
    and not exists (
      select 1
      from public.attendance_logs ao
      where ao.employee_id = al.employee_id
        and ao.action = 'check_out'
        and ao.occurred_at > al.occurred_at
    )
  order by al.occurred_at desc, al.created_at desc
  limit 1;

  if v_shift_start_at is null then
    return jsonb_build_object('inserted', false, 'reason', 'no_open_shift');
  end if;

  if p_site_id is not null and p_site_id is distinct from v_shift_site_id then
    return jsonb_build_object('inserted', false, 'reason', 'site_mismatch');
  end if;

  if exists (
    select 1
    from public.attendance_breaks b
    where b.employee_id = v_employee_id
      and b.ended_at is null
  ) then
    return jsonb_build_object('inserted', false, 'reason', 'on_break');
  end if;

  insert into public.attendance_shift_events (
    employee_id,
    site_id,
    shift_start_at,
    event_type,
    occurred_at,
    distance_meters,
    accuracy_meters,
    source,
    notes
  )
  values (
    v_employee_id,
    coalesce(p_site_id, v_shift_site_id),
    v_shift_start_at,
    'left_site_open_shift',
    v_event_time,
    v_distance,
    v_accuracy,
    coalesce(p_source, 'mobile'),
    p_notes
  )
  on conflict (employee_id, shift_start_at, event_type) do nothing
  returning id
    into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('inserted', false, 'reason', 'already_recorded');
  end if;

  return jsonb_build_object(
    'inserted', true,
    'event_id', v_event_id,
    'shift_start_at', v_shift_start_at
  );
end;
$$;

grant execute on function public.register_shift_departure_event(
  uuid,
  integer,
  integer,
  text,
  text,
  timestamptz
) to authenticated;

create or replace function public.enforce_attendance_geofence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site record;
  v_emp record;

  v_requires_geo boolean;
  v_max_acc integer;
  v_radius integer;

  v_distance double precision;
  v_accuracy double precision;
  v_is_assigned boolean;
begin
  if new.source <> 'system' then
    new.occurred_at := now();
  end if;

  select id, site_id, is_active
    into v_emp
  from public.employees
  where id = new.employee_id;

  if not found then
    raise exception 'Empleado no encontrado';
  end if;

  if v_emp.is_active is false then
    raise exception 'Empleado inactivo';
  end if;

  if new.action = 'check_in' then
    v_is_assigned := (v_emp.site_id is not distinct from new.site_id)
      or exists (
        select 1
        from public.employee_sites es
        where es.employee_id = new.employee_id
          and es.site_id = new.site_id
          and es.is_active = true
      );

    if not v_is_assigned then
      raise exception 'No autorizado: check-in solo permitido en tu sede asignada';
    end if;
  end if;

  select id, name, type, is_active, latitude, longitude, checkin_radius_meters
    into v_site
  from public.sites
  where id = new.site_id;

  if not found then
    raise exception 'Sede no encontrada';
  end if;

  if v_site.is_active is false then
    raise exception 'Sede inactiva';
  end if;

  if new.source = 'system' then
    return new;
  end if;

  if v_site.type <> 'vento_group' then
    if v_site.latitude is null or v_site.longitude is null then
      raise exception 'Configuración inválida: la sede % no tiene coordenadas', v_site.name;
    end if;
    if v_site.checkin_radius_meters is null or v_site.checkin_radius_meters <= 0 then
      raise exception 'Configuración inválida: la sede % no tiene radio de check-in configurado', v_site.name;
    end if;
    v_requires_geo := true;
  else
    v_requires_geo := false;
  end if;

  if v_requires_geo then
    if new.latitude is null or new.longitude is null or new.accuracy_meters is null then
      raise exception 'Ubicación requerida para registrar asistencia';
    end if;

    if public.device_info_has_blocking_warnings(new.device_info) then
      raise exception 'Ubicación no válida: señales de ubicación simulada detectadas';
    end if;

    if new.action = 'check_in' then
      v_max_acc := 20;
    elsif new.action = 'check_out' then
      v_max_acc := 25;
    else
      raise exception 'Acción inválida: %', new.action;
    end if;

    v_radius := v_site.checkin_radius_meters;
    v_accuracy := new.accuracy_meters::double precision;

    if v_accuracy > v_max_acc then
      raise exception 'Precisión GPS insuficiente: %m (máximo %m)', round(v_accuracy), v_max_acc;
    end if;

    v_distance := public.haversine_m(new.latitude, new.longitude, v_site.latitude, v_site.longitude);

    if (v_distance + v_accuracy) > v_radius then
      raise exception 'Fuera de rango: %m (precisión %m) > radio %m',
        round(v_distance), round(v_accuracy), v_radius;
    end if;
  end if;

  return new;
end;
$$;
