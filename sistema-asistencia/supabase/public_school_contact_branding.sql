-- Expone únicamente el teléfono institucional opcional para el enlace de WhatsApp público.
-- Nunca devuelve teléfonos de estudiantes, apoderados o usuarios.
create or replace function public.obtener_identidad_publica_colegio(p_colegio_slug text default 'san-pio-x-circa')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'nombre_colegio', s.nombre_colegio,
    'lema', s.lema,
    'logo_url', s.logo_url,
    'color_principal', s.color_principal,
    'color_secundario', s.color_secundario,
    'color_fondo', s.color_fondo,
    'modo', s.modo,
    'telefono', s.telefono
  )
  from public.configuracion_sistema s
  join public.colegios c on c.id_colegio = s.id_colegio
  where c.slug = p_colegio_slug
    and c.estado in ('ACTIVO', 'PRUEBA')
  order by s.id_configuracion
  limit 1
$function$;

revoke all on function public.obtener_identidad_publica_colegio(text) from public;
grant execute on function public.obtener_identidad_publica_colegio(text) to anon, authenticated;
