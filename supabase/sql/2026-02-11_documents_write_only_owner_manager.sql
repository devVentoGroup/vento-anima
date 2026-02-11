-- Restringe escrituras en public.documents:
-- solo propietarios y gerentes pueden insertar/actualizar/eliminar.
-- Los demás roles autenticados mantienen acceso de lectura según políticas existentes.

-- INSERT: debe cumplir rol permitido.
drop policy if exists documents_write_restrict_insert_owner_manager on public.documents;
create policy documents_write_restrict_insert_owner_manager
  on public.documents
  as restrictive
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.employees e
      where e.id = auth.uid()
        and e.is_active = true
        and e.role in ('propietario', 'gerente_general', 'gerente')
    )
  );

-- UPDATE: requiere rol permitido para la fila actual y la nueva versión.
drop policy if exists documents_write_restrict_update_owner_manager on public.documents;
create policy documents_write_restrict_update_owner_manager
  on public.documents
  as restrictive
  for update
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

-- DELETE: requiere rol permitido.
drop policy if exists documents_write_restrict_delete_owner_manager on public.documents;
create policy documents_write_restrict_delete_owner_manager
  on public.documents
  as restrictive
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.employees e
      where e.id = auth.uid()
        and e.is_active = true
        and e.role in ('propietario', 'gerente_general', 'gerente')
    )
  );
