(() => {
  const client = window.supabase?.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
  const allowedRoles = new Set(["SUPERADMIN", "DIRECTOR", "ADMINISTRADOR", "AUXILIAR"]);

  async function getAuthorizedProfile(userId) {
    const { data, error } = await client
      .from("perfiles")
      .select("id_usuario,id_colegio,nombres,apellidos,activo,roles(nombre,activo)")
      .eq("id_usuario", userId)
      .maybeSingle();
    if (error) throw error;
    const role = Array.isArray(data?.roles) ? data.roles[0] : data?.roles;
    if (!data?.activo || !role?.activo || !allowedRoles.has(role.nombre)) return null;
    const { data: authData } = await client.auth.getSession();
    const sameUser = authData.session?.user?.id === userId;
    return { ...data, role: role.nombre, requiereCambioContrasena: sameUser && authData.session.user.app_metadata?.requiere_cambio_contrasena === true };
  }

  function loginPath() {
    return new URL("../admin/login.html", window.location.href).href;
  }

  window.adminAuth = { client, getAuthorizedProfile, loginPath };
})();
