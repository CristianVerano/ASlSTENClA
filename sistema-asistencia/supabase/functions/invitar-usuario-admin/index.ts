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
  if (!url || !publishableKey || !serviceRoleKey) return json({ error: "Falta configurar el servicio de invitaciones." }, 500);

  const accessToken = authorization.slice("Bearer ".length);
  const userClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "La sesión no es válida." }, 401);

  const { data: actor, error: actorError } = await userClient
    .from("perfiles")
    .select("activo,roles(nombre,activo)")
    .eq("id_usuario", userData.user.id)
    .maybeSingle();
  const actorRole = Array.isArray(actor?.roles) ? actor.roles[0] : actor?.roles;
  if (actorError || !actor?.activo || !actorRole?.activo || actorRole.nombre !== "DIRECTOR") {
    return json({ error: "Solo un director activo puede invitar personal." }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "La solicitud no contiene datos válidos." }, 400); }
  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (body.action === "listar") {
    const { data: userList, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return json({ error: "No se pudo consultar la lista de cuentas." }, 500);
    return json({ ok: true, emails: (userList.users || []).map((user) => ({ id: user.id, email: user.email || "", confirmado: Boolean(user.email_confirmed_at), ultimo_acceso: user.last_sign_in_at || null })) });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const nombres = typeof body.nombres === "string" ? body.nombres.trim() : "";
  const apellidos = typeof body.apellidos === "string" ? body.apellidos.trim() : "";
  const idRol = Number(body.id_rol);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Escribe un correo electrónico válido." }, 400);
  if (!nombres || nombres.length > 100 || !apellidos || apellidos.length > 100 || !Number.isInteger(idRol)) return json({ error: "Completa nombres, apellidos y rol." }, 400);

  const { data: role, error: roleError } = await adminClient.from("roles").select("id_rol,nombre,activo").eq("id_rol", idRol).maybeSingle();
  if (roleError || !role?.activo) return json({ error: "El rol seleccionado no está disponible." }, 400);

  const origin = request.headers.get("origin");
  let redirectTo: string;
  try {
    const parsedOrigin = new URL(origin || "");
    const localHttp = parsedOrigin.protocol === "http:" && (parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1");
    if (parsedOrigin.protocol !== "https:" && !localHttp) throw new Error("Origen no seguro");
    redirectTo = new URL("/pages/admin/accept-invite.html", parsedOrigin.origin).href;
  } catch {
    return json({ error: "No se pudo determinar la dirección segura para aceptar la invitación." }, 400);
  }
  const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { nombres, apellidos },
  });
  if (inviteError || !invitation.user) {
    return json({ error: inviteError?.message || "No se pudo enviar la invitación." }, 400);
  }

  const { error: profileError } = await adminClient.from("perfiles").insert({
    id_usuario: invitation.user.id,
    id_rol: role.id_rol,
    nombres,
    apellidos,
    activo: true,
  });
  if (profileError) {
    await adminClient.auth.admin.deleteUser(invitation.user.id);
    return json({ error: profileError.code === "23505" ? "Ese usuario ya tiene un perfil." : "La invitación se creó, pero no se pudo asignar el rol." }, 500);
  }

  return json({ ok: true, user_id: invitation.user.id, email, rol: role.nombre });
});
