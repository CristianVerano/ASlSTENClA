-- Días con clases por semana y validación autoritativa en el kiosco.
-- DOW de PostgreSQL: domingo=0, lunes=1, ..., sábado=6.
alter table public.configuracion_asistencia
  add column if not exists dias_laborables smallint[] not null default array[1,2,3,4,5]::smallint[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'configuracion_asistencia_dias_laborables_validos'
      and conrelid = 'public.configuracion_asistencia'::regclass
  ) then
    alter table public.configuracion_asistencia
      add constraint configuracion_asistencia_dias_laborables_validos
      check (cardinality(dias_laborables) > 0 and dias_laborables <@ array[0,1,2,3,4,5,6]::smallint[]);
  end if;
end $$;

create or replace function public.registrar_asistencia_publica(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config record;
  v_estudiante bigint;
  v_fecha date;
  v_hora time;
  v_dia_semana smallint;
  v_estado text;
  v_motivo text;
  v_guardado public.asistencias%rowtype;
begin
  if p_codigo is null or btrim(p_codigo) = '' then
    raise exception 'Código de estudiante no válido' using errcode = '22023';
  end if;

  select c.hora_inicio, c.hora_tardanza, c.hora_falta, c.dias_laborables
    into v_config
    from public.configuracion_asistencia c
   where c.activo = true
   order by c.id_configuracion
   limit 1;
  if not found then
    raise exception 'No hay una configuración de asistencia activa' using errcode = 'P0001';
  end if;

  select e.id_estudiante into v_estudiante
    from public.estudiantes e
    join public.secciones s on s.id_seccion = e.id_seccion and s.activo = true
    join public.grados g on g.id_grado = s.id_grado and g.activo = true
   where e.codigo = btrim(p_codigo) and e.activo = true;
  if not found then
    raise exception 'Estudiante no encontrado o inactivo' using errcode = 'P0002';
  end if;

  v_fecha := (now() at time zone 'America/Lima')::date;
  v_hora := (now() at time zone 'America/Lima')::time;
  v_dia_semana := extract(dow from v_fecha)::smallint;

  select d.motivo into v_motivo
    from public.dias_no_laborables d
   where d.fecha = v_fecha and d.activo = true
   limit 1;
  if found then
    return jsonb_build_object('resultado', 'NO_LABORABLE', 'motivo', v_motivo, 'fecha', v_fecha);
  end if;
  if not (v_dia_semana = any(v_config.dias_laborables)) then
    return jsonb_build_object('resultado', 'NO_LABORABLE', 'motivo', 'Hoy no hay clases según el calendario semanal', 'fecha', v_fecha);
  end if;

  v_estado := case
    when v_hora >= v_config.hora_falta then 'FALTA'
    when v_hora >= v_config.hora_tardanza then 'TARDANZA'
    else 'PRESENTE'
  end;
  insert into public.asistencias (id_estudiante, fecha, hora_ingreso, estado)
  values (v_estudiante, v_fecha, v_hora, v_estado)
  on conflict (id_estudiante, fecha) do nothing
  returning * into v_guardado;
  if found then
    return jsonb_build_object('resultado', 'REGISTRADO', 'estado', v_guardado.estado, 'fecha', v_guardado.fecha, 'hora_ingreso', v_guardado.hora_ingreso);
  end if;

  select a.estado, a.fecha, a.hora_ingreso
    into v_guardado.estado, v_guardado.fecha, v_guardado.hora_ingreso
    from public.asistencias a
   where a.id_estudiante = v_estudiante and a.fecha = v_fecha;
  return jsonb_build_object('resultado', 'DUPLICADO', 'estado', v_guardado.estado, 'fecha', v_guardado.fecha, 'hora_ingreso', v_guardado.hora_ingreso);
end;
$$;
