-- Auto-close open shifts at day end and allow system check-outs

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
  v_cap integer;
  v_max_acc integer;
  v_radius integer;

  v_distance double precision;
  v_accuracy double precision;
  v_is_assigned boolean;
begin
  -- Hora servidor (anti manipulacion)
  if new.source <> 'system' then
    new.occurred_at := now();
  end if;

  -- Empleado: debe existir y estar activo
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

  -- En check_in, la sede debe estar asignada al empleado (site_id o employee_sites)
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

  -- Sede: debe existir y estar activa
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

  -- Si es cierre automatico del sistema, omite validacion de geolocalizacion
  if new.source = 'system' then
    return new;
  end if;

  -- Requiere geolocalizacion si NO es vento_group
  if v_site.type <> 'vento_group' then
    if v_site.latitude is null or v_site.longitude is null then
      raise exception 'Configuracion invalida: la sede % no tiene coordenadas', v_site.name;
    end if;
    v_requires_geo := true;
  else
    v_requires_geo := false;
  end if;

  if v_requires_geo then
    -- Debe venir ubicacion
    if new.latitude is null or new.longitude is null or new.accuracy_meters is null then
      raise exception 'Ubicacion requerida para registrar asistencia';
    end if;

    -- Si el cliente reporta warnings bloqueantes, rechaza
    if public.device_info_has_blocking_warnings(new.device_info) then
      raise exception 'Ubicacion no valida: senales de ubicacion simulada detectadas';
    end if;

    -- Politica estricta
    if new.action = 'check_in' then
      v_cap := 20;
      v_max_acc := 20;
    elsif new.action = 'check_out' then
      v_cap := 30;
      v_max_acc := 25;
    else
      raise exception 'Accion invalida: %', new.action;
    end if;

    v_radius := least(coalesce(v_site.checkin_radius_meters, 50), v_cap);
    v_accuracy := new.accuracy_meters::double precision;

    if v_accuracy > v_max_acc then
      raise exception 'Precision GPS insuficiente: %m (maximo %m)', round(v_accuracy), v_max_acc;
    end if;

    v_distance := public.haversine_m(new.latitude, new.longitude, v_site.latitude, v_site.longitude);

    -- Regla estricta de confianza: distancia + precision <= radio
    if (v_distance + v_accuracy) > v_radius then
      raise exception 'Fuera de rango: %m (precision %m) > radio %m',
        round(v_distance), round(v_accuracy), v_radius;
    end if;
  end if;

  return new;
end;
$$;

-- Close open shifts at local day end (23:59:59)
create or replace function public.close_open_attendance_day_end(
  p_timezone text default 'America/Bogota'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_closed int := 0;
begin
  v_day_start := (date_trunc('day', now() at time zone p_timezone)) at time zone p_timezone;
  v_day_end := (date_trunc('day', now() at time zone p_timezone) + interval '1 day' - interval '1 second') at time zone p_timezone;

  with last_logs as (
    select distinct on (employee_id)
      employee_id,
      site_id,
      action,
      occurred_at
    from public.attendance_logs
    where occurred_at <= v_day_end
    order by employee_id, occurred_at desc, created_at desc
  ),
  inserted as (
    insert into public.attendance_logs (
      employee_id,
      site_id,
      action,
      source,
      occurred_at,
      latitude,
      longitude,
      accuracy_meters,
      device_info,
      notes
    )
    select
      l.employee_id,
      l.site_id,
      'check_out',
      'system',
      v_day_end,
      s.latitude,
      s.longitude,
      0,
      jsonb_build_object('auto_close', true, 'reason', 'day_end'),
      'Cierre automatico: turno abierto cerrado por el sistema a las 23:59'
    from last_logs l
    join public.sites s on s.id = l.site_id
    where l.action = 'check_in'
      and not exists (
        select 1
        from public.attendance_logs al
        where al.employee_id = l.employee_id
          and al.action = 'check_out'
          and al.occurred_at > l.occurred_at
          and al.occurred_at <= v_day_end
      )
    returning 1
  )
  select count(*) into v_closed from inserted;

  return v_closed;
end;
$$;

-- Schedule daily close (UTC). Colombia is UTC-5, so 23:59 local = 04:59 UTC.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'auto-close-attendance') then
      perform cron.schedule(
        'auto-close-attendance',
        '59 4 * * *',
        'select public.close_open_attendance_day_end(''America/Bogota'');'
      );
    end if;
  end if;
end $$;
