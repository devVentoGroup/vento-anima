-- ANIMA remote app update policy (forced + optional updates)

create table if not exists public.app_update_policies (
  id uuid primary key default gen_random_uuid(),
  app_key text not null,
  platform text not null check (platform in ('ios', 'android')),
  min_version text not null default '0.0.0',
  latest_version text,
  force_update boolean not null default false,
  store_url text,
  title text,
  message text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_update_policies_app_platform_unique unique (app_key, platform)
);

create index if not exists app_update_policies_enabled_idx
  on public.app_update_policies (app_key, platform, is_enabled);

create unique index if not exists app_update_policies_app_platform_uidx
  on public.app_update_policies (app_key, platform);

alter table public.app_update_policies enable row level security;

grant select on table public.app_update_policies to anon, authenticated;

drop policy if exists app_update_policies_select_public on public.app_update_policies;
create policy app_update_policies_select_public
  on public.app_update_policies
  for select
  to anon, authenticated
  using (is_enabled = true);

drop trigger if exists app_update_policies_set_updated_at on public.app_update_policies;
create trigger app_update_policies_set_updated_at
before update on public.app_update_policies
for each row execute function public.set_updated_at();

-- Ejemplo de uso (rellenar con URLs reales de App Store y Play Store):
-- insert into public.app_update_policies (
--   app_key, platform, min_version, latest_version, force_update, store_url, title, message, is_enabled
-- ) values
-- (
--   'vento_anima',
--   'ios',
--   '1.1.0',
--   '1.1.2',
--   false,
--   'https://apps.apple.com/app/idXXXXXXXXXX',
--   'Actualizacion disponible',
--   'Instala la version mas reciente para mejorar estabilidad y check-in.',
--   true
-- ),
-- (
--   'vento_anima',
--   'android',
--   '1.1.0',
--   '1.1.2',
--   false,
--   'https://play.google.com/store/apps/details?id=com.vento.anima',
--   'Actualizacion disponible',
--   'Instala la version mas reciente para mejorar estabilidad y check-in.',
--   true
-- )
-- on conflict (app_key, platform)
-- do update set
--   min_version = excluded.min_version,
--   latest_version = excluded.latest_version,
--   force_update = excluded.force_update,
--   store_url = excluded.store_url,
--   title = excluded.title,
--   message = excluded.message,
--   is_enabled = excluded.is_enabled;
