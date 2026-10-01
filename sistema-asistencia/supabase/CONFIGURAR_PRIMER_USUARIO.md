# Crear la primera cuenta administrativa

Para arrancar el sistema se necesita al menos una cuenta DIRECTOR. La primera cuenta se crea desde Supabase Auth y se vincula manualmente con `perfiles`. Después, el director puede crear cuentas de Administrador y Auxiliar desde **Usuarios y roles**: el sistema asigna una contraseña temporal y exige cambiarla en el primer ingreso.

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

Luego abre `pages/admin/login.html`, inicia sesión con el correo y contraseña creados, y el panel validará el perfil y el rol antes de mostrar el dashboard. Las nuevas cuentas de Administrador y Auxiliar se crean desde **Usuarios y roles**. Comparte la contraseña temporal por un canal privado; el sistema pedirá cambiarla al iniciar sesión.

La recuperación de contraseña sigue usando el correo de Supabase Auth. En **Authentication → URL Configuration → Redirect URLs**, agrega `https://tu-dominio-vercel.vercel.app/**` y reemplaza el ejemplo por el dominio real de Vercel. La función `invitar-usuario-admin` verifica el JWT y el perfil DIRECTOR en cada solicitud. Usa la clave de servicio exclusivamente en el servidor Supabase; nunca la copies al frontend.

No agregues una clave `service_role` al frontend. La página usa la clave publishable/anon guardada en `js/supabase-config.js`.
