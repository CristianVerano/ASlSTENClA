# Cambios de Supabase para el sistema

El proyecto `frzrwzltfxvdehtjrcum` ya tiene aplicados los cambios descritos aquí. Estos archivos quedan en la carpeta como referencia y respaldo; no vuelvas a ejecutar políticas con el mismo nombre en la base existente.

- `director_manage_profiles.sql`: permite a DIRECTOR consultar perfiles y asignar o modificar roles de otras cuentas, pero no cambiar su propio rol.
- `calendar_and_public_branding.sql`: incorpora la validación de días no laborables y la lectura pública acotada de nombre, lema, logo y colores del colegio.
- `dias_laborables_y_control_semanal.sql`: guarda los días de clase de lunes a domingo y evita registros públicos en días desactivados.
- `kiosk_register_by_code_only.sql`: migración final del kiosco. Las funciones públicas reciben el código y resuelven el estudiante en Supabase; reemplaza la versión anterior que aceptaba el ID numérico.
- `cierre_asistencia_automatico.sql`: configura cierre manual o automático por colegio, genera faltas para estudiantes activos sin marca de asistencia, omite feriados y días sin clases y registra un solo cierre por fecha. Ya está aplicado en el proyecto.
- `contactos_apoderados_notificaciones.sql`: agrega correo, WhatsApp y consentimiento explícito del apoderado al registro de estudiante. Los envíos reales todavía requieren conectar proveedores.
- `functions/invitar-usuario-admin/index.ts`: función de servidor cuyo nombre histórico se conserva. Lista cuentas y crea usuarios para DIRECTOR con contraseña inicial, confirma su correo, les exige cambiar la contraseña al entrar y asigna el perfil. Requiere JWT y comprueba el rol DIRECTOR. La clave de servicio solo se usa en el entorno de Supabase. La versión desplegada debe coincidir con este archivo para activar los cambios locales.

La interfaz web se conecta con la clave publishable de `js/supabase-config.js`. No copies `service_role` en ningún archivo HTML o JavaScript.

## Acceso del personal

El director crea cuentas de Administrador y Auxiliar desde **Usuarios y roles**, incluyendo una contraseña inicial que debe entregar por un canal privado. Supabase marca la cuenta para que cambie la contraseña en el primer ingreso; la pantalla es `pages/admin/cambiar-contrasena.html`. El inicio de sesión también incluye recuperación por correo, que usa `pages/admin/accept-invite.html`. En Supabase → Authentication → URL Configuration, agrega a **Redirect URLs** la ruta del dominio Vercel, por ejemplo `https://tu-dominio.vercel.app/**`. Reemplaza el dominio de ejemplo por el que muestra tu proyecto Vercel. No cambies la clave publishable del frontend.

## Multi-colegio y superadministración

`multicolegio_base.sql` ya está aplicado al proyecto `frzrwzltfxvdehtjrcum`. Conserva el colegio existente y asigna sus filas al colegio SAN PIO X- CIRCA. Añade aislamiento RLS por institución, claves foráneas compuestas y RPC públicas del kiosco con parámetro de colegio. El enlace del kiosco usa `?colegio=<slug>`; el colegio actual conserva `san-pio-x-circa` como valor predeterminado.

El panel local `pages/superadmin/dashboard.html` permite consultar colegios y preparar el registro de uno nuevo con Director, cuentas y configuración inicial. Antes de usar el panel, configura la primera cuenta SUPERADMIN siguiendo `CONFIGURAR_SUPERADMIN.md`.

## Mejoras en curso

- `pages/admin/importar-estudiantes.html`: importa hasta 500 estudiantes desde Excel. Valida códigos, DNI, contactos autorizados y aulas del colegio; no escribe filas si encuentra errores ni sube el archivo a un servicio externo.
- `pages/admin/configuracion.html`: el Director elige cierre manual o automático y la hora. El cierre manual está limitado al Director; el programado corre una vez por minuto y usa la hora de Lima.
- Las notificaciones familiares por correo y WhatsApp requieren guardar los datos de contacto y conectar credenciales de proveedores. No se envían mensajes hasta configurar esos servicios.
