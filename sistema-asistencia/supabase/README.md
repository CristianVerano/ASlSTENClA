# Cambios de Supabase para el sistema

El proyecto `frzrwzltfxvdehtjrcum` ya tiene aplicados los cambios descritos aquí. Estos archivos quedan en la carpeta como referencia y respaldo; no vuelvas a ejecutar políticas con el mismo nombre en la base existente.

- `director_manage_profiles.sql`: permite a DIRECTOR consultar perfiles y asignar o modificar roles de otras cuentas, pero no cambiar su propio rol.
- `calendar_and_public_branding.sql`: incorpora la validación de días no laborables y la lectura pública acotada de nombre, lema, logo y colores del colegio.
- `dias_laborables_y_control_semanal.sql`: guarda los días de clase de lunes a domingo y evita registros públicos en días desactivados.
- `kiosk_register_by_code_only.sql`: migración final del kiosco. Las funciones públicas reciben el código y resuelven el estudiante en Supabase; reemplaza la versión anterior que aceptaba el ID numérico.
- `functions/invitar-usuario-admin/index.ts`: función de servidor activa que invita usuarios, lista correos para DIRECTOR y asigna el perfil. Requiere JWT y comprueba el rol DIRECTOR. La clave de servicio solo se usa en el entorno de Supabase.

La interfaz web se conecta con la clave publishable de `js/supabase-config.js`. No copies `service_role` en ningún archivo HTML o JavaScript.

## Acceso del personal

El director invita al personal desde **Usuarios y roles**. La invitación dirige a `pages/admin/accept-invite.html`, donde cada persona establece su contraseña; el inicio de sesión también incluye recuperación de contraseña. En Supabase → Authentication → URL Configuration, agrega a **Redirect URLs** la ruta del dominio Vercel, por ejemplo `https://tu-dominio.vercel.app/**`. Reemplaza el dominio de ejemplo por el que muestra tu proyecto Vercel. No cambies la clave publishable del frontend.
