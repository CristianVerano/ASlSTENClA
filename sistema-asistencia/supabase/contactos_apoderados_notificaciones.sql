-- Contactos de apoderados; el consentimiento es requisito previo para notificar.
alter table public.estudiantes
  add column if not exists correo_apoderado text,
  add column if not exists telefono_apoderado text,
  add column if not exists acepta_notificaciones boolean not null default false;

alter table public.estudiantes drop constraint if exists estudiantes_correo_apoderado_check;
alter table public.estudiantes add constraint estudiantes_correo_apoderado_check
  check (correo_apoderado is null or correo_apoderado ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
alter table public.estudiantes drop constraint if exists estudiantes_telefono_apoderado_check;
alter table public.estudiantes add constraint estudiantes_telefono_apoderado_check
  check (telefono_apoderado is null or telefono_apoderado ~ '^[+]?[0-9][0-9 ()-]{7,19}$');
