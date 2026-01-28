-- Document types catalog and document fields

create table if not exists public.document_types (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  scope public.document_scope not null default 'employee',
  requires_expiry boolean not null default false,
  validity_months integer,
  reminder_days integer not null default 7,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists document_types_name_scope_idx
  on public.document_types (name, scope);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_document_types_updated_at'
  ) then
    create trigger set_document_types_updated_at
    before update on public.document_types
    for each row execute procedure public._set_updated_at();
  end if;
end $$;

alter table public.documents
  add column if not exists document_type_id uuid,
  add column if not exists issue_date date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_document_type_id_fkey'
  ) then
    alter table public.documents
      add constraint documents_document_type_id_fkey
      foreign key (document_type_id)
      references public.document_types(id)
      on delete set null;
  end if;
end $$;

alter table public.document_types enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_types'
      and policyname = 'document_types_select'
  ) then
    create policy document_types_select
      on public.document_types
      for select
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_types'
      and policyname = 'document_types_write_admin'
  ) then
    create policy document_types_write_admin
      on public.document_types
      using (
        public.is_owner()
        or public.is_global_manager()
        or public.current_employee_role() = 'gerente'
      )
      with check (
        public.is_owner()
        or public.is_global_manager()
        or public.current_employee_role() = 'gerente'
      );
  end if;
end $$;

insert into public.document_types (name, scope, requires_expiry, validity_months, reminder_days, is_active)
values
  ('Contrato laboral (si aplica)', 'employee', false, null, 7, true),
  ('Fecha de ingreso', 'employee', false, null, 7, true),
  ('Para saber si requiere contrato', 'employee', false, null, 7, true),
  ('Certificado de manipulacion de alimentos', 'employee', true, 12, 7, true),
  ('Examenes periodicos de salud', 'employee', true, 6, 7, true),
  ('Dotacion', 'employee', true, 6, 7, true)
on conflict (name, scope)
  do update set
    requires_expiry = excluded.requires_expiry,
    validity_months = excluded.validity_months,
    reminder_days = excluded.reminder_days,
    is_active = excluded.is_active;
