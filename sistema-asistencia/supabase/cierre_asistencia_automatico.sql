-- Cierre de asistencia por colegio, con ejecución automática y manual.
-- La hora se interpreta en America/Lima. El registro diario evita duplicados.

alter table public.configuracion_asistencia
  add column if not exists modo_cierre_faltas text not null default 'MANUAL',
  add column if not exists hora_cierre_faltas time without time zone not null default '08:30';
update public.configuracion_asistencia set hora_cierre_faltas=hora_falta where hora_cierre_faltas='08:30' and hora_falta<>'08:30';
alter table public.configuracion_asistencia
  drop constraint if exists configuracion_asistencia_modo_cierre_faltas_check;
alter table public.configuracion_asistencia
  add constraint configuracion_asistencia_modo_cierre_faltas_check
  check (modo_cierre_faltas in ('MANUAL','AUTOMATICO'));

create schema if not exists private;
grant usage on schema private to authenticated;

create table if not exists private.cierres_asistencia_diarios (
  id_colegio bigint not null references public.colegios(id_colegio) on delete cascade,
  fecha date not null,
  modo text not null check (modo in ('MANUAL','AUTOMATICO')),
  id_usuario uuid null references auth.users(id) on delete set null,
  faltas_registradas integer not null default 0,
  fecha_cierre timestamptz not null default now(),
  primary key (id_colegio, fecha)
);
alter table private.cierres_asistencia_diarios enable row level security;
revoke all on private.cierres_asistencia_diarios from public, anon, authenticated;

create or replace function private.cerrar_asistencia_colegio(p_id_colegio bigint, p_fecha date, p_modo text, p_id_usuario uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_dias smallint[]; v_insertadas integer := 0;
begin
  select ca.dias_laborables into v_dias from public.configuracion_asistencia ca
  where ca.id_colegio=p_id_colegio and ca.activo order by ca.id_configuracion limit 1;
  if v_dias is null or extract(dow from p_fecha)::smallint <> all(v_dias)
     or exists (select 1 from public.dias_no_laborables d where d.id_colegio=p_id_colegio and d.fecha=p_fecha and d.activo) then
    return -1;
  end if;
  insert into private.cierres_asistencia_diarios(id_colegio,fecha,modo,id_usuario)
  values (p_id_colegio,p_fecha,p_modo,p_id_usuario) on conflict (id_colegio,fecha) do nothing;
  if not found then
    select c.faltas_registradas into v_insertadas from private.cierres_asistencia_diarios c
    where c.id_colegio=p_id_colegio and c.fecha=p_fecha;
    return coalesce(v_insertadas,0);
  end if;
  insert into public.asistencias(id_estudiante,fecha,estado,observacion,id_colegio)
  select e.id_estudiante,p_fecha,'FALTA','Falta generada al cerrar asistencia',p_id_colegio
  from public.estudiantes e where e.id_colegio=p_id_colegio and e.activo
    and not exists (select 1 from public.asistencias a where a.id_colegio=p_id_colegio and a.id_estudiante=e.id_estudiante and a.fecha=p_fecha)
  on conflict (id_colegio,id_estudiante,fecha) do nothing;
  get diagnostics v_insertadas = row_count;
  update private.cierres_asistencia_diarios set faltas_registradas=v_insertadas where id_colegio=p_id_colegio and fecha=p_fecha;
  return v_insertadas;
end;
$$;
revoke all on function private.cerrar_asistencia_colegio(bigint,date,text,uuid) from public,anon,authenticated;

create or replace function public.cerrar_asistencia_manual_hoy()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_id_colegio bigint; v_modo text; v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Se requiere iniciar sesión.'; end if;
  select p.id_colegio into v_id_colegio from public.perfiles p join public.roles r on r.id_rol=p.id_rol
  where p.id_usuario=(select auth.uid()) and p.activo and r.activo and r.nombre='DIRECTOR' and p.id_colegio is not null;
  if v_id_colegio is null then raise exception 'Solo el director del colegio puede cerrar la asistencia.'; end if;
  select ca.modo_cierre_faltas into v_modo from public.configuracion_asistencia ca
  where ca.id_colegio=v_id_colegio and ca.activo order by ca.id_configuracion limit 1;
  if v_modo <> 'MANUAL' then raise exception 'Este colegio tiene configurado el cierre automático.'; end if;
  v_count := private.cerrar_asistencia_colegio(v_id_colegio,(now() at time zone 'America/Lima')::date,'MANUAL',(select auth.uid()));
  if v_count=-1 then raise exception 'Hoy no es un día laborable del colegio.'; end if;
  return v_count;
end;
$$;
revoke all on function public.cerrar_asistencia_manual_hoy() from public,anon;
grant execute on function public.cerrar_asistencia_manual_hoy() to authenticated;

create or replace function private.ejecutar_cierres_automaticos()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_config record; v_fecha date := (now() at time zone 'America/Lima')::date;
  v_hora time := (now() at time zone 'America/Lima')::time; v_total integer := 0; v_resultado integer;
begin
  for v_config in
    select ca.id_colegio from public.configuracion_asistencia ca join public.colegios c on c.id_colegio=ca.id_colegio
    where ca.activo and ca.modo_cierre_faltas='AUTOMATICO' and ca.hora_cierre_faltas<=v_hora
      and extract(dow from v_fecha)::smallint=any(ca.dias_laborables) and c.estado in ('ACTIVO','PRUEBA')
      and not exists (select 1 from public.dias_no_laborables d where d.id_colegio=ca.id_colegio and d.fecha=v_fecha and d.activo)
  loop
    v_resultado := private.cerrar_asistencia_colegio(v_config.id_colegio,v_fecha,'AUTOMATICO',null);
    if v_resultado>0 then v_total := v_total+v_resultado; end if;
  end loop;
  return v_total;
end;
$$;
revoke all on function private.ejecutar_cierres_automaticos() from public,anon,authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname='cierre-asistencia-automatica';
select cron.schedule('cierre-asistencia-automatica','* * * * *','select private.ejecutar_cierres_automaticos();');
