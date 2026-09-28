-- Actualiza el RPC del kiosco para no registrar asistencia en fechas activas
-- de dias_no_laborables. La validación se ejecuta en Supabase, no en el cliente.
create or replace function public.registrar_asistencia_publica(p_id_estudiante bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_config record; v_estudiante bigint; v_fecha date; v_hora time; v_estado text; v_motivo text;
  v_guardado public.asistencias%rowtype;
begin
  if p_id_estudiante is null then raise exception 'Estudiante no válido' using errcode = '22023'; end if;
  select c.hora_inicio,c.hora_tardanza,c.hora_falta into v_config from public.configuracion_asistencia c where c.activo=true order by c.id_configuracion limit 1;
  if not found then raise exception 'No hay una configuración de asistencia activa' using errcode = 'P0001'; end if;
  select e.id_estudiante into v_estudiante from public.estudiantes e join public.secciones s on s.id_seccion=e.id_seccion and s.activo=true join public.grados g on g.id_grado=s.id_grado and g.activo=true where e.id_estudiante=p_id_estudiante and e.activo=true;
  if not found then raise exception 'Estudiante no encontrado o inactivo' using errcode = 'P0002'; end if;
  v_fecha := (now() at time zone 'America/Lima')::date;
  v_hora := (now() at time zone 'America/Lima')::time;
  select d.motivo into v_motivo from public.dias_no_laborables d where d.fecha=v_fecha and d.activo=true limit 1;
  if found then return jsonb_build_object('resultado','NO_LABORABLE','motivo',v_motivo,'fecha',v_fecha); end if;
  v_estado := case when v_hora>=v_config.hora_falta then 'FALTA' when v_hora>=v_config.hora_tardanza then 'TARDANZA' else 'PRESENTE' end;
  insert into public.asistencias(id_estudiante,fecha,hora_ingreso,estado) values(v_estudiante,v_fecha,v_hora,v_estado) on conflict(id_estudiante,fecha) do nothing returning * into v_guardado;
  if found then return jsonb_build_object('resultado','REGISTRADO','estado',v_guardado.estado,'fecha',v_guardado.fecha,'hora_ingreso',v_guardado.hora_ingreso); end if;
  select a.estado,a.fecha,a.hora_ingreso into v_guardado.estado,v_guardado.fecha,v_guardado.hora_ingreso from public.asistencias a where a.id_estudiante=v_estudiante and a.fecha=v_fecha;
  return jsonb_build_object('resultado','DUPLICADO','estado',v_guardado.estado,'fecha',v_guardado.fecha,'hora_ingreso',v_guardado.hora_ingreso);
end;
$$;

-- RPC público con identidad segura para la pantalla: no devuelve correo,
-- dirección ni teléfono del colegio.
create or replace function public.obtener_identidad_publica_colegio()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('nombre_colegio',c.nombre_colegio,'lema',c.lema,'logo_url',c.logo_url,'color_principal',c.color_principal,'color_secundario',c.color_secundario,'color_fondo',c.color_fondo,'modo',c.modo)
  from public.configuracion_sistema c order by c.id_configuracion limit 1
$$;
revoke all on function public.obtener_identidad_publica_colegio() from public;
grant execute on function public.obtener_identidad_publica_colegio() to anon,authenticated;
