-- Tabla para Novedades (ANIMA)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  tag text not null default 'INFO',
  published_at timestamptz not null default now(),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_not_empty check (length(trim(title)) > 0),
  constraint announcements_body_not_empty check (length(trim(body)) > 0),
  constraint announcements_tag_valid check (tag in ('IMPORTANTE', 'INFO', 'ALERTA'))
);

create index if not exists announcements_active_order_idx
  on public.announcements (is_active, display_order, published_at desc);

alter table public.announcements enable row level security;

-- Limpia policies previas del mismo nombre para re-ejecuciones seguras.
drop policy if exists announcements_select_authenticated on public.announcements;
drop policy if exists announcements_write_management on public.announcements;

-- Todos los autenticados pueden leer novedades activas.
create policy announcements_select_authenticated
  on public.announcements
  for select
  to authenticated
  using (is_active = true);

-- Solo propietarios / gerentes generales / gerentes pueden gestionar novedades.
create policy announcements_write_management
  on public.announcements
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.employees e
      where e.id = auth.uid()
        and e.is_active = true
        and e.role in ('propietario', 'gerente_general', 'gerente')
    )
  )
  with check (
    exists (
      select 1
      from public.employees e
      where e.id = auth.uid()
        and e.is_active = true
        and e.role in ('propietario', 'gerente_general', 'gerente')
    )
  );

-- Seed inicial (solo si no existen por titulo).
insert into public.announcements (title, body, tag, published_at, is_active, display_order)
select
  'Nueva politica de turnos',
  'A partir del lunes, los check-ins deben hacerse dentro del radio definido por cada sede.',
  'IMPORTANTE',
  now() - interval '20 days',
  true,
  10
where not exists (
  select 1 from public.announcements where title = 'Nueva politica de turnos'
);

insert into public.announcements (title, body, tag, published_at, is_active, display_order)
select
  'Mantenimiento programado',
  'El sistema estara en mantenimiento este sabado de 2:00 a 4:00 a.m.',
  'ALERTA',
  now() - interval '23 days',
  true,
  20
where not exists (
  select 1 from public.announcements where title = 'Mantenimiento programado'
);

insert into public.announcements (title, body, tag, published_at, is_active, display_order)
select
  'Nuevo modulo de documentos',
  'Pronto podras firmar documentos desde la app sin salir de ANIMA.',
  'INFO',
  now() - interval '27 days',
  true,
  30
where not exists (
  select 1 from public.announcements where title = 'Nuevo modulo de documentos'
);
