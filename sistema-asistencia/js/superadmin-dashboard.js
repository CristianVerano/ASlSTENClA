(() => {
  const { client, getAuthorizedProfile, loginPath } = window.adminAuth || {};
  let schools = [];
  let selectedSchool = null;
  let slugWasEdited = false;
  const byId = (id) => document.getElementById(id);
  const number = (value) => new Intl.NumberFormat("es-PE").format(value || 0);
  const showPlatformMessage = (message, success = false) => { byId("platformMessage").textContent = message; byId("platformMessage").className = `dashboard-message${success ? " success" : ""}`; byId("platformMessage").hidden = false; };
  const text = (id, value) => { byId(id).textContent = value; };
  const formMessage = (message) => { byId("schoolFormMessage").textContent = message; byId("schoolFormMessage").className = "school-form-message"; byId("schoolFormMessage").hidden = false; };
  const stateLabel = (state) => ({ ACTIVO: "Activo", PRUEBA: "En prueba", SUSPENDIDO: "Suspendido", CANCELADO: "Cancelado" })[state] || "Por configurar";

  function renderSchools() {
    const rows = byId("schoolRows");
    const query = byId("schoolSearch").value.trim().toLocaleLowerCase("es");
    const filtered = schools.filter((school) => `${school.nombre} ${school.slug} ${school.plan} ${school.estado}`.toLocaleLowerCase("es").includes(query));
    rows.replaceChildren();
    if (!filtered.length) {
      const row = document.createElement("tr"); const cell = document.createElement("td");
      cell.colSpan = 9; cell.className = "empty-row"; cell.textContent = schools.length ? "No hay colegios que coincidan con la búsqueda." : "Todavía no hay colegios registrados.";
      row.append(cell); rows.append(row); return;
    }
    filtered.forEach((school) => {
      const row = document.createElement("tr");
      const name = document.createElement("td"); const strong = document.createElement("strong"); strong.textContent = school.nombre; name.append(strong);
      const slug = document.createElement("td"); slug.textContent = school.slug;
      const plan = document.createElement("td"); plan.textContent = school.plan || "Inicial";
      const status = document.createElement("td"); const badge = document.createElement("span"); const state = String(school.estado || "").toUpperCase();
      badge.className = `table-status ${state === "ACTIVO" ? "presente" : state === "SUSPENDIDO" || state === "CANCELADO" ? "falta" : "tardanza"}`;
      badge.textContent = stateLabel(state); status.append(badge);
      const countCell = (value) => { const cell = document.createElement("td"); cell.className = "platform-number"; cell.textContent = number(value); return cell; };
      const students = countCell(school.estudiantes); const users = countCell(school.usuarios); const attendance = countCell(school.asistencias);
      const created = document.createElement("td"); created.textContent = school.fecha_registro ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" }).format(new Date(school.fecha_registro)) : "—";
      const actions = document.createElement("td"); const manage = document.createElement("button"); manage.type = "button"; manage.className = "school-manage-button"; manage.dataset.manageSchool = school.id_colegio; manage.textContent = "Administrar"; actions.append(manage);
      row.append(name, slug, plan, status, students, users, attendance, created, actions); rows.append(row);
    });
  }

  async function loadSchools() {
    const { data, error } = await client.functions.invoke("invitar-usuario-admin", { body: { action: "resumen-colegios" } });
    if (error || data?.error) throw new Error(data?.error || error.message || "No se pudo consultar la plataforma.");
    schools = data?.colegios || [];
    const totals = data?.totales || {};
    text("schoolCount", number(totals.colegios)); text("activeCount", number(totals.activos));
    text("trialCount", number(totals.prueba)); text("suspendedCount", number(totals.suspendidos));
    text("studentCount", number(totals.estudiantes)); text("staffCount", number(totals.usuarios));
    text("schoolSummary", `${number(totals.colegios)} institución${totals.colegios === 1 ? "" : "es"} · ${number(totals.asistencias)} asistencias acumuladas`);
    byId("platformMessage").hidden = true; renderSchools();
  }

  async function initialize() {
    if (!client) return window.location.replace(loginPath());
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session) return window.location.replace(loginPath());
    try {
      const profile = await getAuthorizedProfile(session.user.id);
      if (!profile) { await client.auth.signOut(); return window.location.replace(loginPath()); }
      if (profile.requiereCambioContrasena) return window.location.replace("../admin/cambiar-contrasena.html");
      if (profile.role !== "SUPERADMIN") return window.location.replace("../admin/dashboard.html");
      text("userName", [profile.nombres, profile.apellidos].filter(Boolean).join(" ") || session.user.email);
      text("userInitials", `${profile.nombres?.[0] || "S"}${profile.apellidos?.[0] || "A"}`.toLocaleUpperCase("es"));
      text("todayLabel", new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" }).format(new Date()));
      text("year", new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", year: "numeric" }).format(new Date()));
      await loadSchools();
    } catch (error) {
      console.error("No se pudo cargar la plataforma:", error);
      showPlatformMessage(error.message || "No se pudo cargar el registro de colegios. Revisa la conexión y los permisos del panel.");
    }
  }

  byId("schoolSearch").addEventListener("input", renderSchools);
  byId("addSchool").addEventListener("click", () => { byId("schoolForm").reset(); slugWasEdited = false; byId("schoolFormMessage").hidden = true; byId("schoolDialog").showModal(); });
  document.querySelectorAll("[data-school-close]").forEach((button) => button.addEventListener("click", () => byId("schoolDialog").close()));
  byId("newSchoolSlug").addEventListener("input", () => { slugWasEdited = true; });
  byId("newSchoolName").addEventListener("input", (event) => {
    if (slugWasEdited) return;
    byId("newSchoolSlug").value = event.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  });
  byId("schoolForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = byId("saveSchool"); button.disabled = true; byId("schoolFormMessage").hidden = true;
    const payload = { action: "crear-colegio", nombre_colegio: byId("newSchoolName").value.trim(), slug: byId("newSchoolSlug").value.trim(), plan: byId("newSchoolPlan").value, nombres: byId("newDirectorNames").value.trim(), apellidos: byId("newDirectorLastNames").value.trim(), email: byId("newDirectorEmail").value.trim(), password: byId("newDirectorPassword").value };
    try {
      const { data, error } = await client.functions.invoke("invitar-usuario-admin", { body: payload });
      if (error || data?.error) {
        let detail = data?.error;
        try { detail ||= (await error?.context?.clone().json())?.error; } catch { /* La respuesta puede no contener JSON. */ }
        throw new Error(detail || "No se pudo registrar el colegio.");
      }
      byId("schoolDialog").close();
      showPlatformMessage(`Colegio registrado. Entrega al Director la contraseña temporal por un canal privado. Kiosco: ?colegio=${data.slug}`, true);
      try { await loadSchools(); } catch (refreshError) { console.warn("El colegio se creó, pero no se pudo actualizar la lista:", refreshError); }
    } catch (error) {
      console.error("No se pudo registrar el colegio:", error); formMessage(error.message || "No se pudo registrar el colegio.");
    } finally { button.disabled = false; }
  });

  byId("schoolRows").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-manage-school]"); if (!button) return;
    selectedSchool = schools.find((school) => String(school.id_colegio) === button.dataset.manageSchool); if (!selectedSchool) return;
    text("manageSchoolTitle", selectedSchool.nombre); text("manageSchoolSlug", selectedSchool.slug);
    byId("manageSchoolState").value = selectedSchool.estado; byId("manageSchoolPlan").value = selectedSchool.plan || "Inicial";
    text("manageStudents", number(selectedSchool.estudiantes)); text("manageUsers", number(selectedSchool.usuarios)); text("manageAttendance", number(selectedSchool.asistencias));
    byId("openSchoolKiosk").href = `../../index.html?colegio=${encodeURIComponent(selectedSchool.slug)}`;
    byId("manageSchoolMessage").hidden = true; byId("manageSchoolDialog").showModal();
  });
  document.querySelectorAll("[data-manage-close]").forEach((button) => button.addEventListener("click", () => byId("manageSchoolDialog").close()));
  byId("manageSchoolForm").addEventListener("submit", async (event) => {
    event.preventDefault(); if (!selectedSchool) return;
    const button = byId("saveSchoolChanges"); button.disabled = true; byId("manageSchoolMessage").hidden = true;
    try {
      const payload = { action: "actualizar-colegio", id_colegio: selectedSchool.id_colegio, estado: byId("manageSchoolState").value, plan: byId("manageSchoolPlan").value };
      const { data, error } = await client.functions.invoke("invitar-usuario-admin", { body: payload });
      if (error || data?.error) throw new Error(data?.error || error.message || "No se pudo guardar el colegio.");
      byId("manageSchoolDialog").close(); await loadSchools(); showPlatformMessage(`Se guardaron los cambios de ${data.colegio.nombre}.`, true);
    } catch (error) {
      console.error("No se pudo actualizar el colegio:", error); byId("manageSchoolMessage").textContent = error.message || "No se pudo guardar el colegio."; byId("manageSchoolMessage").hidden = false;
    } finally { button.disabled = false; }
  });
  byId("logoutButton").addEventListener("click", async () => { await client?.auth.signOut(); window.location.replace(loginPath()); });
  initialize();
})();
