-- Allow multi-site employees to check in at any assigned site

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
  new.occurred_at := now();

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

  -- Requiere geolocalizacion si tiene coordenadas configuradas
  if v_site.latitude is not null and v_site.longitude is not null then
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
