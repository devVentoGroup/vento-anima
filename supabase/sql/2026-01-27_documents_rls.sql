-- Adjust document insert rules for site uploads

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname = 'documents_insert'
  ) then
    execute $sql$
      alter policy documents_insert
      on public.documents
      with check (
        (owner_employee_id = auth.uid())
        and (
          (scope = 'employee'::document_scope and target_employee_id = auth.uid())
          or (
            scope = 'site'::document_scope
            and (
              public.is_owner()
              or public.is_global_manager()
              or (
                public.current_employee_role() = 'gerente'
                and documents.site_id = (
                  select site_id from public.employees me where me.id = auth.uid()
                )
              )
            )
          )
          or (
            scope = 'group'::document_scope
            and (public.is_owner() or public.is_global_manager())
          )
        )
      );
    $sql$;
  end if;
end $$;
