# Crear la primera cuenta administrativa

Para arrancar el sistema se necesita al menos una cuenta DIRECTOR. Si ya puedes iniciar sesión, usa **Usuarios y roles** dentro del panel para invitar al resto del personal; no necesitas crearles perfiles manualmente.

## 1. Crear el usuario en Supabase Auth

En el proyecto `colegio_bd`, abre **Authentication → Users → Add user**. Crea la cuenta inicial del director con su correo y contraseña. Si aparece la opción, confirma el correo del usuario.

Después copia el **UUID** de ese usuario desde la lista de usuarios.

## 2. Asignar el perfil y rol de director

Abre **SQL Editor → New query** y ejecuta el siguiente SQL, reemplazando el UUID y los dos nombres entre comillas por los datos reales:

```sql
insert into public.perfiles (id_usuario, id_rol, nombres, apellidos, activo)
values (
  'PEGA-AQUI-EL-UUID-DEL-USUARIO',
  1,
  'Nombres',
  'Apellidos',
  true
);
```

El proyecto ya tiene activo el rol `DIRECTOR` con `id_rol = 1`. También existen `ADMINISTRADOR` (`id_rol = 2`) y `AUXILIAR` (`id_rol = 3`). Para asignar otro rol, cambia únicamente el número `1` por el ID correspondiente.

Luego abre `pages/admin/login.html`, inicia sesión con el correo y contraseña creados, y el panel validará el perfil y el rol antes de mostrar el dashboard. Cuando la cuenta del director ya funcione, las invitaciones de personal y los cambios de rol se hacen desde **Usuarios y roles**.

Para invitar personal, el proveedor de correo de Supabase Auth debe estar habilitado y tener configurada la URL de retorno del sitio. La función de invitación verifica el JWT y el perfil DIRECTOR en cada solicitud; la clave de servicio permanece en el servidor Supabase.

No agregues una clave `service_role` al frontend. La página usa la clave publishable/anon guardada en `js/supabase-config.js`.
