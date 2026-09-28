-- Permite que DIRECTOR consulte perfiles y asigne/actualice roles de otros
-- usuarios que ya existan en Supabase Auth. No permite editar su propio rol.
create policy perfiles_select_director
  on public.perfiles for select to authenticated
  using (private.usuario_tiene_rol(array['DIRECTOR']::text[]));

create policy perfiles_insert_director
  on public.perfiles for insert to authenticated
  with check (private.usuario_tiene_rol(array['DIRECTOR']::text[]));

create policy perfiles_update_director
  on public.perfiles for update to authenticated
  using (private.usuario_tiene_rol(array['DIRECTOR']::text[]) and id_usuario <> auth.uid())
  with check (private.usuario_tiene_rol(array['DIRECTOR']::text[]) and id_usuario <> auth.uid());
