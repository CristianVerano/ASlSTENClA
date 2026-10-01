# Activar la primera cuenta SUPERADMIN

La migración multi-colegio ya creó el rol `SUPERADMIN`. Por seguridad, no se asignó automáticamente a ninguna de las cuentas Director existentes.

1. En el proyecto Supabase `colegio_bd`, abre **Authentication → Users → Add user** y crea una cuenta nueva para la administración de la plataforma. Confirma el correo y guarda la contraseña en un lugar seguro.
2. Copia el UUID de esa cuenta.
3. Abre **SQL Editor → New query**, reemplaza el UUID y los nombres, y ejecuta:

```sql
begin;

insert into public.perfiles (id_usuario, id_rol, id_colegio, nombres, apellidos, activo)
select
  'PEGA-AQUI-EL-UUID'::uuid,
  r.id_rol,
  null,
  'Nombre del superadministrador',
  'Apellido',
  true
from public.roles r
where r.nombre = 'SUPERADMIN' and r.activo = true;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('requiere_cambio_contrasena', true)
where id = 'PEGA-AQUI-EL-UUID'::uuid;

commit;
```

4. Inicia sesión desde `pages/admin/login.html`. La cuenta será redirigida al panel global y deberá cambiar la contraseña en su primer ingreso.

Usa una cuenta separada de las cuentas Director de cada institución. No pongas `service_role` en el sitio web.
