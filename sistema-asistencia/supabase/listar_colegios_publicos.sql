create or replace function public.listar_colegios_publicos()
returns table(id_colegio bigint, nombre text, slug text)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select c.id_colegio, c.nombre, c.slug
  from public.colegios as c
  order by lower(c.nombre), c.id_colegio;
$$;

grant select (id_colegio, nombre, slug) on public.colegios to anon, authenticated;

drop policy if exists colegios_publicos_select_public on public.colegios;
create policy colegios_publicos_select_public
  on public.colegios
  for select
  to anon, authenticated
  using (estado in ('ACTIVO', 'PRUEBA'));

revoke all on function public.listar_colegios_publicos() from public;
grant execute on function public.listar_colegios_publicos() to anon, authenticated;
