-- Push tokens for Expo notifications

create table if not exists public.employee_push_tokens (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references public.employees(id) on delete cascade,
  token text not null,
  platform text,
  device_id text,
  is_active boolean not null default true,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employee_push_tokens_token_idx
  on public.employee_push_tokens (token);

create index if not exists employee_push_tokens_employee_idx
  on public.employee_push_tokens (employee_id);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_employee_push_tokens_updated_at'
  ) then
    create trigger set_employee_push_tokens_updated_at
    before update on public.employee_push_tokens
    for each row execute procedure public._set_updated_at();
  end if;
end $$;

alter table public.employee_push_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_push_tokens'
      and policyname = 'employee_push_tokens_select_self'
  ) then
    create policy employee_push_tokens_select_self
      on public.employee_push_tokens
      for select
      using (employee_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_push_tokens'
      and policyname = 'employee_push_tokens_insert_self'
  ) then
    create policy employee_push_tokens_insert_self
      on public.employee_push_tokens
      for insert
      with check (employee_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_push_tokens'
      and policyname = 'employee_push_tokens_update_self'
  ) then
    create policy employee_push_tokens_update_self
      on public.employee_push_tokens
      for update
      using (employee_id = auth.uid())
      with check (employee_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_push_tokens'
      and policyname = 'employee_push_tokens_delete_self'
  ) then
    create policy employee_push_tokens_delete_self
      on public.employee_push_tokens
      for delete
      using (employee_id = auth.uid());
  end if;
end $$;
