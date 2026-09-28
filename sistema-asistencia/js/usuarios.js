(() => {
  const byId = (id) => document.getElementById(id);
  let app; let profiles = []; let roles = []; let emails = new Map();
  function show(target, text, type = "success") { target.textContent = text; target.className = `module-alert show ${type}`; }
  async function loadData() {
    const [profileResult, roleResult] = await Promise.all([
      app.client.from("perfiles").select("id_usuario,id_rol,nombres,apellidos,activo,roles(nombre)").order("nombres"),
      app.client.from("roles").select("id_rol,nombre,descripcion,activo").eq("activo", true).order("id_rol")
    ]);
    const error = profileResult.error || roleResult.error; if (error) throw error;
    profiles = profileResult.data || []; roles = roleResult.data || [];
    const { data: authUsers, error: authError } = await app.client.functions.invoke("invitar-usuario-admin", { body: { action: "listar" } });
    emails = new Map((authUsers?.emails || []).map((user) => [user.id, user.email]));
    if (authError) console.warn("No se pudieron mostrar los correos de Auth:", authError.message);
    const select = byId("profileRole"); select.replaceChildren(new Option("Selecciona un rol", "")); roles.forEach((role) => select.add(new Option(role.nombre, role.id_rol)));
    render();
  }
  function render() {
    const rows = byId("profileRows"); rows.replaceChildren();
    if (!profiles.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 5; td.className = "empty-cell"; td.textContent = "Todavía no hay perfiles de acceso."; tr.append(td); rows.append(tr); return; }
    profiles.forEach((profile) => {
      const row = document.createElement("tr"); const mine = profile.id_usuario === app.session.user.id;
      const person = document.createElement("td"); person.textContent = `${profile.apellidos}, ${profile.nombres}${mine ? " (tú)" : ""}`;
      const email = document.createElement("td"); email.textContent = emails.get(profile.id_usuario) || "—"; email.title = profile.id_usuario;
      const roleCell = document.createElement("td");
      if (mine) { const badge = document.createElement("span"); badge.className = "table-status presente"; badge.textContent = profile.roles?.nombre || "—"; roleCell.append(badge); }
      else { const roleSelect = document.createElement("select"); roleSelect.className = "inline-role"; roleSelect.dataset.user = profile.id_usuario; roles.forEach((role) => roleSelect.add(new Option(role.nombre, role.id_rol, false, role.id_rol === profile.id_rol))); roleCell.append(roleSelect); }
      const state = document.createElement("td"); const badge = document.createElement("span"); badge.className = `table-status ${profile.activo ? "presente" : "falta"}`; badge.textContent = profile.activo ? "Activo" : "Inactivo"; state.append(badge);
      const action = document.createElement("td");
      if (!mine) { const button = document.createElement("button"); button.type = "button"; button.className = `row-action${profile.activo ? " danger" : ""}`; button.dataset.toggleUser = profile.id_usuario; button.textContent = profile.activo ? "Desactivar acceso" : "Reactivar acceso"; action.append(button); }
      else action.textContent = "Cuenta protegida";
      row.append(person, email, roleCell, state, action); rows.append(row);
    });
  }
  byId("addProfile").addEventListener("click", () => { byId("profileForm").reset(); byId("profileFormAlert").className = "module-alert"; byId("profileDialog").showModal(); });
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => byId(button.dataset.close).close()));
  byId("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const button = byId("saveProfile"); button.disabled = true;
    const record = { email: byId("profileEmail").value.trim(), id_rol: Number(byId("profileRole").value), nombres: byId("profileNames").value.trim(), apellidos: byId("profileLastNames").value.trim() };
    try {
      const { data, error } = await app.client.functions.invoke("invitar-usuario-admin", { body: record });
      if (error || data?.error) throw new Error(data?.error || error.message);
      await app.logAction("INVITAR_USUARIO", `${record.email} · ${record.nombres} ${record.apellidos} · ${roles.find((role) => role.id_rol === record.id_rol)?.nombre}`);
      byId("profileDialog").close(); show(byId("profilesAlert"), `Invitación enviada a ${record.email}.`); await loadData();
    } catch (error) { console.error(error); show(byId("profileFormAlert"), error.message || "No se pudo enviar la invitación. Verifica el correo y la configuración de Auth.", "error"); }
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
