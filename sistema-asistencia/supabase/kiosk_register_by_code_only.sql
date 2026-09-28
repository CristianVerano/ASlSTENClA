-- Reduce el acceso público al kiosco: ya no se acepta el ID secuencial de
-- estudiante; la función valida el código en Supabase antes de insertar.
drop function if exists public.buscar_estudiante_asistencia(text);
drop function if exists public.registrar_asistencia_publica(bigint);

create function public.buscar_estudiante_asistencia(p_codigo text)
returns table (codigo text,nombres text,apellidos text,grado text,nivel text,seccion text)
language sql stable security definer set search_path = '' as $$
  select e.codigo::text,e.nombres::text,e.apellidos::text,g.nombre::text,g.nivel::text,s.nombre::text
  from public.estudiantes e join public.secciones s on s.id_seccion=e.id_seccion join public.grados g on g.id_grado=s.id_grado
  where e.codigo=btrim(p_codigo) and e.activo=true and s.activo=true and g.activo=true limit 1
$$;

create function public.registrar_asistencia_publica(p_codigo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_config record; v_estudiante bigint; v_fecha date; v_hora time; v_estado text; v_motivo text; v_guardado public.asistencias%rowtype;
begin
  if p_codigo is null or btrim(p_codigo)='' then raise exception 'Código de estudiante no válido' using errcode='22023'; end if;
  select c.hora_inicio,c.hora_tardanza,c.hora_falta into v_config from public.configuracion_asistencia c where c.activo=true order by c.id_configuracion limit 1;
  if not found then raise exception 'No hay una configuración de asistencia activa' using errcode='P0001'; end if;
  select e.id_estudiante into v_estudiante from public.estudiantes e join public.secciones s on s.id_seccion=e.id_seccion and s.activo=true join public.grados g on g.id_grado=s.id_grado and g.activo=true where e.codigo=btrim(p_codigo) and e.activo=true;
  if not found then raise exception 'Estudiante no encontrado o inactivo' using errcode='P0002'; end if;
  v_fecha := (now() at time zone 'America/Lima')::date; v_hora := (now() at time zone 'America/Lima')::time;
  select d.motivo into v_motivo from public.dias_no_laborables d where d.fecha=v_fecha and d.activo=true limit 1;
  if found then return jsonb_build_object('resultado','NO_LABORABLE','motivo',v_motivo,'fecha',v_fecha); end if;
  v_estado := case when v_hora>=v_config.hora_falta then 'FALTA' when v_hora>=v_config.hora_tardanza then 'TARDANZA' else 'PRESENTE' end;
  insert into public.asistencias(id_estudiante,fecha,hora_ingreso,estado) values(v_estudiante,v_fecha,v_hora,v_estado) on conflict(id_estudiante,fecha) do nothing returning * into v_guardado;
  if found then return jsonb_build_object('resultado','REGISTRADO','estado',v_guardado.estado,'fecha',v_guardado.fecha,'hora_ingreso',v_guardado.hora_ingreso); end if;
  select a.estado,a.fecha,a.hora_ingreso into v_guardado.estado,v_guardado.fecha,v_guardado.hora_ingreso from public.asistencias a where a.id_estudiante=v_estudiante and a.fecha=v_fecha;
  return jsonb_build_object('resultado','DUPLICADO','estado',v_guardado.estado,'fecha',v_guardado.fecha,'hora_ingreso',v_guardado.hora_ingreso);
end;
$$;
revoke all on function public.buscar_estudiante_asistencia(text) from public,authenticated;
revoke all on function public.registrar_asistencia_publica(text) from public,authenticated;
grant execute on function public.buscar_estudiante_asistencia(text) to anon;
grant execute on function public.registrar_asistencia_publica(text) to anon;
revoke all on function public.obtener_identidad_publica_colegio() from public,authenticated;
grant execute on function public.obtener_identidad_publica_colegio() to anon;
