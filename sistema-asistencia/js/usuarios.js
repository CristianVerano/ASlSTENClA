(() => {
  const byId = (id) => document.getElementById(id);
  let app; let profiles = []; let roles = []; let emails = new Map(); let authUsers = new Map();
  function show(target, text, type = "success") { target.textContent = text; target.className = `module-alert show ${type}`; }
  function friendlyAccountError(message) {
    const value = String(message || "").toLocaleLowerCase("es");
    if (value.includes("already registered") || value.includes("already exists") || value.includes("ya está registrado")) return "Ese correo ya tiene una cuenta en Supabase. Revisa la lista de usuarios antes de intentarlo nuevamente.";
    if (value.includes("password") || value.includes("contraseña")) return "No se pudo crear la cuenta. Revisa que la contraseña tenga al menos 12 caracteres.";
    return message || "No se pudo crear la cuenta. Verifica el correo y vuelve a intentarlo.";
  }
  async function loadData() {
    const [profileResult, roleResult] = await Promise.all([
      app.client.from("perfiles").select("id_usuario,id_rol,nombres,apellidos,activo,roles(nombre)").order("nombres"),
      app.client.from("roles").select("id_rol,nombre,descripcion,activo").eq("activo", true).neq("nombre", "SUPERADMIN").order("id_rol")
    ]);
    const error = profileResult.error || roleResult.error; if (error) throw error;
    profiles = profileResult.data || []; roles = roleResult.data || [];
    const { data: authData, error: authError } = await app.client.functions.invoke("invitar-usuario-admin", { body: { action: "listar" } });
    emails = new Map((authData?.emails || []).map((user) => [user.id, user.email]));
    authUsers = new Map((authData?.emails || []).map((user) => [user.id, user]));
    if (authError) console.warn("No se pudieron mostrar los correos de Auth:", authError.message);
    const select = byId("profileRole"); select.replaceChildren(new Option("Selecciona un rol", "")); roles.filter((role) => ["ADMINISTRADOR", "AUXILIAR"].includes(role.nombre)).forEach((role) => select.add(new Option(role.nombre, role.id_rol)));
    render();
  }
  async function confirmAccountWasCreated(email, existedBefore) {
    if (existedBefore) return false;
    try {
      const { data, error } = await app.client.functions.invoke("invitar-usuario-admin", { body: { action: "listar" } });
      if (error) return false;
      const account = (data?.emails || []).find((user) => user.email?.toLocaleLowerCase("es") === email.toLocaleLowerCase("es"));
      if (!account) return false;
      const { data: profile, error: profileError } = await app.client.from("perfiles").select("id_usuario").eq("id_usuario", account.id).maybeSingle();
      return !profileError && Boolean(profile);
    } catch { return false; }
  }
  function render() {
    const rows = byId("profileRows"); rows.replaceChildren();
    if (!profiles.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 6; td.className = "empty-cell"; td.textContent = "Todavía no hay perfiles de acceso."; tr.append(td); rows.append(tr); return; }
    profiles.forEach((profile) => {
      const row = document.createElement("tr"); const mine = profile.id_usuario === app.session.user.id;
      const person = document.createElement("td"); person.textContent = `${profile.apellidos}, ${profile.nombres}${mine ? " (tú)" : ""}`;
      const email = document.createElement("td"); email.textContent = emails.get(profile.id_usuario) || "—"; email.title = profile.id_usuario;
      const roleCell = document.createElement("td");
      if (mine) { const badge = document.createElement("span"); badge.className = "table-status presente"; badge.textContent = profile.roles?.nombre || "—"; roleCell.append(badge); }
      else { const roleSelect = document.createElement("select"); roleSelect.className = "inline-role"; roleSelect.dataset.user = profile.id_usuario; roles.forEach((role) => roleSelect.add(new Option(role.nombre, role.id_rol, false, role.id_rol === profile.id_rol))); roleCell.append(roleSelect); }
      const state = document.createElement("td"); const badge = document.createElement("span"); const auth = authUsers.get(profile.id_usuario); const pending = profile.activo && auth && !auth.confirmado; const mustChangePassword = auth?.requiere_cambio_contrasena; badge.className = `table-status ${!profile.activo ? "falta" : pending || mustChangePassword ? "tardanza" : "presente"}`; badge.textContent = !profile.activo ? "Inactivo" : pending ? "Invitación pendiente" : mustChangePassword ? "Cambio de clave pendiente" : "Activo"; state.append(badge);
      const lastAccess = document.createElement("td"); lastAccess.textContent = auth?.ultimo_acceso ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(auth.ultimo_acceso)) : mustChangePassword ? "Primer ingreso pendiente" : pending ? "Aún no aceptó" : "Sin ingresos";
      const action = document.createElement("td");
      if (!mine) { const button = document.createElement("button"); button.type = "button"; button.className = `row-action${profile.activo ? " danger" : ""}`; button.dataset.toggleUser = profile.id_usuario; button.textContent = profile.activo ? "Desactivar acceso" : "Reactivar acceso"; action.append(button); }
      else action.textContent = "Cuenta protegida";
      row.append(person, email, roleCell, state, lastAccess, action); rows.append(row);
    });
  }
  byId("addProfile").addEventListener("click", () => { byId("profileForm").reset(); byId("profileFormAlert").className = "module-alert"; byId("profileDialog").showModal(); });
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => byId(button.dataset.close).close()));
  byId("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const button = byId("saveProfile"); button.disabled = true;
    const record = { email: byId("profileEmail").value.trim(), id_rol: Number(byId("profileRole").value), nombres: byId("profileNames").value.trim(), apellidos: byId("profileLastNames").value.trim(), password: byId("profilePassword").value };
    if (record.password !== byId("profilePasswordConfirm").value) { show(byId("profileFormAlert"), "Las contraseñas no coinciden.", "error"); button.disabled = false; return; }
    if (record.password.length < 12) { show(byId("profileFormAlert"), "La contraseña inicial debe tener al menos 12 caracteres.", "error"); button.disabled = false; return; }
    const existedBefore = [...authUsers.values()].some((user) => user.email?.toLocaleLowerCase("es") === record.email.toLocaleLowerCase("es"));
    try {
      const { data, error } = await app.client.functions.invoke("invitar-usuario-admin", { body: { action: "crear", ...record } });
      if (error) {
        let detail = data?.error;
        try { detail ||= (await error.context?.clone().json())?.error; } catch { /* La respuesta puede no contener JSON. */ }
        if (!(await confirmAccountWasCreated(record.email, existedBefore))) throw new Error(friendlyAccountError(detail || error.message));
      }
      if (data?.error && !(await confirmAccountWasCreated(record.email, existedBefore))) throw new Error(friendlyAccountError(data.error));
      await app.logAction("CREAR_CUENTA_USUARIO", `${record.email} · ${record.nombres} ${record.apellidos} · ${roles.find((role) => role.id_rol === record.id_rol)?.nombre}`);
      byId("profileDialog").close(); show(byId("profilesAlert"), `Cuenta creada para ${record.email}. Entrega la contraseña temporal por un canal privado.`);
      try { await loadData(); }
      catch (refreshError) { console.warn("La cuenta quedó creada, pero la lista no se actualizó:", refreshError); show(byId("profilesAlert"), `La cuenta sí se creó para ${record.email}, pero la lista no se pudo actualizar. Recarga la página para verla.`, "success"); }
    } catch (error) { console.error(error); show(byId("profileFormAlert"), friendlyAccountError(error.message), "error"); }
    finally { button.disabled = false; }
  });
  byId("profileRows").addEventListener("change", async (event) => {
    const select = event.target.closest("select.inline-role"); if (!select) return;
    const profile = profiles.find((item) => item.id_usuario === select.dataset.user); if (!profile) return;
    const oldRole = profile.id_rol; const nextRole = Number(select.value);
    const { error } = await app.client.from("perfiles").update({ id_rol: nextRole }).eq("id_usuario", profile.id_usuario);
    if (error) { select.value = oldRole; show(byId("profilesAlert"), "No se pudo cambiar el rol. La base de datos protege la cuenta del director.", "error"); return; }
    await app.logAction("CAMBIAR_ROL", `${profile.nombres} ${profile.apellidos} · ${roles.find((role) => role.id_rol === oldRole)?.nombre} → ${roles.find((role) => role.id_rol === nextRole)?.nombre}`); show(byId("profilesAlert"), "Rol actualizado."); await loadData();
  });
  byId("profileRows").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-toggle-user]"); if (!button) return;
    const profile = profiles.find((item) => item.id_usuario === button.dataset.toggleUser); if (!profile) return;
    const next = !profile.activo; if (!confirm(`${next ? "¿Reactivar" : "¿Desactivar"} el acceso de ${profile.nombres} ${profile.apellidos}?`)) return;
    const { error } = await app.client.from("perfiles").update({ activo: next }).eq("id_usuario", profile.id_usuario);
    if (error) { show(byId("profilesAlert"), "No se pudo actualizar el acceso.", "error"); return; }
    await app.logAction(next ? "REACTIVAR_PERFIL" : "DESACTIVAR_PERFIL", `${profile.nombres} ${profile.apellidos}`); await loadData(); show(byId("profilesAlert"), next ? "Acceso reactivado." : "Acceso desactivado.");
  });
  window.moduleReady.then(async (context) => { if (!context) return; app = context; try { await loadData(); } catch (error) { console.error(error); show(byId("profilesAlert"), "No se pudieron cargar usuarios y roles.", "error"); } });
})();
