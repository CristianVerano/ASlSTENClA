import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sesión requerida." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = request.headers.get("apikey");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publishableKey || !serviceRoleKey) return json({ error: "Falta configurar el servicio de gestión de cuentas." }, 500);

  const accessToken = authorization.slice("Bearer ".length);
  const userClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "La sesión no es válida." }, 401);

  const { data: actor, error: actorError } = await userClient
    .from("perfiles")
    .select("activo,id_colegio,roles(nombre,activo)")
    .eq("id_usuario", userData.user.id)
    .maybeSingle();
  const actorRole = Array.isArray(actor?.roles) ? actor.roles[0] : actor?.roles;
  if (actorError || !actor?.activo || !actorRole?.activo) return json({ error: "La cuenta no tiene un perfil activo." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "La solicitud no contiene datos válidos." }, 400); }
  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (body.action === "confirmar-cambio-contrasena") {
    if (userData.user.app_metadata?.requiere_cambio_contrasena !== true) return json({ error: "No hay un cambio de contraseña pendiente." }, 403);
    const { error } = await adminClient.auth.admin.updateUserById(userData.user.id, {
      app_metadata: { ...userData.user.app_metadata, requiere_cambio_contrasena: false },
    });
    if (error) return json({ error: "No se pudo confirmar el cambio. Inicia sesión de nuevo e inténtalo otra vez." }, 500);
    return json({ ok: true });
  }
  if (body.action === "crear-colegio") {
    if (actorRole.nombre !== "SUPERADMIN") return json({ error: "Solo el superadministrador puede registrar colegios." }, 403);
    const nombreColegio = typeof body.nombre_colegio === "string" ? body.nombre_colegio.trim() : "";
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const plan = typeof body.plan === "string" ? body.plan.trim() : "Inicial";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const nombres = typeof body.nombres === "string" ? body.nombres.trim() : "";
    const apellidos = typeof body.apellidos === "string" ? body.apellidos.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!nombreColegio || nombreColegio.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return json({ error: "Completa el nombre y un identificador válido para el colegio." }, 400);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !nombres || nombres.length > 100 || !apellidos || apellidos.length > 100) return json({ error: "Completa los datos válidos del director inicial." }, 400);
    if (password.length < 12 || password.length > 128) return json({ error: "La contraseña inicial debe tener entre 12 y 128 caracteres." }, 400);
    if (!["Inicial", "Estándar", "Institucional"].includes(plan)) return json({ error: "Selecciona un plan válido." }, 400);
    const { data: school, error: schoolError } = await adminClient.from("colegios").insert({ nombre: nombreColegio, slug, plan, estado: "PRUEBA" }).select("id_colegio").single();
    if (schoolError || !school) return json({ error: schoolError?.code === "23505" ? "Ese identificador de colegio ya está ocupado." : "No se pudo crear el colegio." }, 400);
    const { data: directorRole, error: directorRoleError } = await adminClient.from("roles").select("id_rol").eq("nombre", "DIRECTOR").eq("activo", true).single();
    if (directorRoleError || !directorRole) {
      await adminClient.from("colegios").delete().eq("id_colegio", school.id_colegio);
      return json({ error: "No se encontró el rol Director." }, 500);
    }
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombres, apellidos } });
    if (createError || !created.user) {
      await adminClient.from("colegios").delete().eq("id_colegio", school.id_colegio);
      return json({ error: createError?.message || "No se pudo crear la cuenta del director." }, 400);
    }
    const { error: metaError } = await adminClient.auth.admin.updateUserById(created.user.id, { app_metadata: { ...created.user.app_metadata, requiere_cambio_contrasena: true } });
    const { error: profileError } = metaError ? { error: metaError } : await adminClient.from("perfiles").insert({ id_usuario: created.user.id, id_rol: directorRole.id_rol, id_colegio: school.id_colegio, nombres, apellidos, activo: true });
    const { error: schoolConfigError } = profileError ? { error: profileError } : await adminClient.from("configuracion_sistema").insert({ id_colegio: school.id_colegio, nombre_colegio: nombreColegio });
    const { error: attendanceConfigError } = schoolConfigError ? { error: schoolConfigError } : await adminClient.from("configuracion_asistencia").insert({ id_colegio: school.id_colegio });
    if (attendanceConfigError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      await adminClient.from("colegios").delete().eq("id_colegio", school.id_colegio);
      return json({ error: "No se pudo completar la configuración inicial; se revirtieron los registros creados." }, 500);
    }
    return json({ ok: true, id_colegio: school.id_colegio, slug, email });
  }
  if (actorRole.nombre !== "DIRECTOR") return json({ error: "Solo un director puede gestionar cuentas del colegio." }, 403);
  if (body.action === "listar") {
    const { data: userList, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return json({ error: "No se pudo consultar la lista de cuentas." }, 500);
    const { data: schoolProfiles, error: profilesError } = await userClient.from("perfiles").select("id_usuario");
    if (profilesError) return json({ error: "No se pudo consultar la lista de perfiles del colegio." }, 500);
    const allowedIds = new Set((schoolProfiles || []).map((profile) => profile.id_usuario));
    return json({ ok: true, emails: (userList.users || []).filter((user) => allowedIds.has(user.id)).map((user) => ({ id: user.id, email: user.email || "", confirmado: Boolean(user.email_confirmed_at), ultimo_acceso: user.last_sign_in_at || null, requiere_cambio_contrasena: user.app_metadata?.requiere_cambio_contrasena === true })) });
  }
  // Compatibilidad temporal con la pantalla Vercel anterior, que todavía invita por correo.
  if (body.action === "invitar" || body.action === undefined) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const nombres = typeof body.nombres === "string" ? body.nombres.trim() : "";
    const apellidos = typeof body.apellidos === "string" ? body.apellidos.trim() : "";
    const idRol = Number(body.id_rol);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Escribe un correo electrónico válido." }, 400);
    if (!nombres || nombres.length > 100 || !apellidos || apellidos.length > 100 || !Number.isInteger(idRol)) return json({ error: "Completa nombres, apellidos y rol." }, 400);
    const { data: legacyRole, error: legacyRoleError } = await adminClient.from("roles").select("id_rol,nombre,activo").eq("id_rol", idRol).maybeSingle();
    if (legacyRoleError || !legacyRole?.activo || !["ADMINISTRADOR", "AUXILIAR"].includes(legacyRole.nombre)) return json({ error: "Selecciona un rol de Administrador o Auxiliar." }, 400);
    const origin = request.headers.get("origin");
    let redirectTo: string;
    try {
      const parsedOrigin = new URL(origin || "");
      const localHttp = parsedOrigin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname);
      if (parsedOrigin.protocol !== "https:" && !localHttp) throw new Error("Origen no seguro");
      redirectTo = new URL("/pages/admin/accept-invite.html", parsedOrigin.origin).href;
    } catch { return json({ error: "No se pudo determinar la dirección segura para aceptar la invitación." }, 400); }
    const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo, data: { nombres, apellidos } });
    if (inviteError || !invitation.user) return json({ error: inviteError?.message || "No se pudo enviar la invitación." }, 400);
    const { error: legacyProfileError } = await adminClient.from("perfiles").insert({ id_usuario: invitation.user.id, id_rol: legacyRole.id_rol, id_colegio: actor.id_colegio, nombres, apellidos, activo: true });
    if (legacyProfileError) {
      await adminClient.auth.admin.deleteUser(invitation.user.id);
      return json({ error: legacyProfileError.code === "23505" ? "Ese usuario ya tiene un perfil." : "La invitación se creó, pero no se pudo asignar el rol." }, 500);
    }
    return json({ ok: true, user_id: invitation.user.id, email, rol: legacyRole.nombre });
  }
  if (body.action !== "crear") return json({ error: "Acción no reconocida." }, 400);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const nombres = typeof body.nombres === "string" ? body.nombres.trim() : "";
  const apellidos = typeof body.apellidos === "string" ? body.apellidos.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const idRol = Number(body.id_rol);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Escribe un correo electrónico válido." }, 400);
  if (!nombres || nombres.length > 100 || !apellidos || apellidos.length > 100 || !Number.isInteger(idRol)) return json({ error: "Completa nombres, apellidos y rol." }, 400);
  if (password.length < 12 || password.length > 128) return json({ error: "La contraseña inicial debe tener entre 12 y 128 caracteres." }, 400);

  const { data: role, error: roleError } = await adminClient.from("roles").select("id_rol,nombre,activo").eq("id_rol", idRol).maybeSingle();
  if (roleError || !role?.activo || !["ADMINISTRADOR", "AUXILIAR"].includes(role.nombre)) return json({ error: "Selecciona un rol de Administrador o Auxiliar." }, 400);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombres, apellidos },
  });
  if (createError || !created.user) return json({ error: createError?.message || "No se pudo crear la cuenta." }, 400);
  const { error: metadataError } = await adminClient.auth.admin.updateUserById(created.user.id, {
    app_metadata: { ...created.user.app_metadata, requiere_cambio_contrasena: true },
  });
  if (metadataError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: "No se pudo preparar el cambio obligatorio de contraseña." }, 500);
  }

  const { error: profileError } = await adminClient.from("perfiles").insert({
    id_usuario: created.user.id,
    id_rol: role.id_rol,
    id_colegio: actor.id_colegio,
    nombres,
    apellidos,
    activo: true,
  });
  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: profileError.code === "23505" ? "Ese usuario ya tiene un perfil." : "La cuenta se creó, pero no se pudo asignar el rol." }, 500);
  }

  return json({ ok: true, user_id: created.user.id, email, rol: role.nombre });
});
