(() => {
  const { client, getAuthorizedProfile, loginPath } = window.adminAuth || {};
  let schools = [];
  const byId = (id) => document.getElementById(id);
  const showPlatformMessage = (message, success = false) => { byId("platformMessage").textContent = message; byId("platformMessage").className = `dashboard-message${success ? " success" : ""}`; byId("platformMessage").hidden = false; };
  const text = (id, value) => { byId(id).textContent = value; };
  const formMessage = (message, success = false) => { byId("schoolFormMessage").textContent = message; byId("schoolFormMessage").className = `school-form-message${success ? " success" : ""}`; byId("schoolFormMessage").hidden = false; };

  function stateLabel(state) {
    return ({ ACTIVO: "Activo", PRUEBA: "En prueba", SUSPENDIDO: "Suspendido", CANCELADO: "Cancelado" })[state] || "Por configurar";
  }

  function renderSchools() {
    const rows = byId("schoolRows");
    const query = byId("schoolSearch").value.trim().toLocaleLowerCase("es");
    const filtered = schools.filter((school) => `${school.nombre} ${school.slug} ${school.plan} ${school.estado}`.toLocaleLowerCase("es").includes(query));
    rows.replaceChildren();
    if (!filtered.length) {
      const row = document.createElement("tr"); const cell = document.createElement("td");
      cell.colSpan = 5; cell.className = "empty-row"; cell.textContent = schools.length ? "No hay colegios que coincidan con la búsqueda." : "Todavía no hay colegios registrados.";
      row.append(cell); rows.append(row); return;
    }
    filtered.forEach((school) => {
      const row = document.createElement("tr");
      const name = document.createElement("td"); const strong = document.createElement("strong"); strong.textContent = school.nombre; name.append(strong);
      const slug = document.createElement("td"); slug.textContent = school.slug;
      const plan = document.createElement("td"); plan.textContent = school.plan || "Inicial";
      const status = document.createElement("td"); const badge = document.createElement("span");
      const state = String(school.estado || "").toUpperCase();
      badge.className = `table-status ${state === "ACTIVO" ? "presente" : state === "SUSPENDIDO" || state === "CANCELADO" ? "falta" : "tardanza"}`;
      badge.textContent = stateLabel(state); status.append(badge);
      const created = document.createElement("td"); created.textContent = school.fecha_registro ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" }).format(new Date(school.fecha_registro)) : "—";
      row.append(name, slug, plan, status, created); rows.append(row);
    });
  }

  async function loadSchools() {
    const { data, error } = await client.from("colegios").select("id_colegio,nombre,slug,plan,estado,fecha_registro").order("fecha_registro", { ascending: false });
    if (error) throw error;
    schools = data || [];
    const active = schools.filter((school) => school.estado === "ACTIVO").length;
    const trial = schools.filter((school) => school.estado === "PRUEBA").length;
    const suspended = schools.filter((school) => ["SUSPENDIDO", "CANCELADO"].includes(school.estado)).length;
    text("schoolCount", new Intl.NumberFormat("es-PE").format(schools.length));
    text("activeCount", new Intl.NumberFormat("es-PE").format(active));
    text("trialCount", new Intl.NumberFormat("es-PE").format(trial));
    text("suspendedCount", new Intl.NumberFormat("es-PE").format(suspended));
    text("schoolSummary", `${schools.length} institución${schools.length === 1 ? "" : "es"} registrada${schools.length === 1 ? "" : "s"}`);
    byId("platformMessage").hidden = true;
    renderSchools();
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
      showPlatformMessage("No se pudo cargar el registro de colegios. Revisa la conexión y los permisos del panel.");
    }
  }

  byId("schoolSearch").addEventListener("input", renderSchools);
  byId("addSchool").addEventListener("click", () => { byId("schoolForm").reset(); slugWasEdited = false; byId("schoolFormMessage").hidden = true; byId("schoolDialog").showModal(); });
  document.querySelectorAll("[data-school-close]").forEach((button) => button.addEventListener("click", () => byId("schoolDialog").close()));
  let slugWasEdited = false;
  byId("newSchoolSlug").addEventListener("input", () => { slugWasEdited = true; });
  byId("newSchoolName").addEventListener("input", (event) => {
    if (slugWasEdited) return;
    byId("newSchoolSlug").value = event.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  });
  byId("schoolForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = byId("saveSchool"); button.disabled = true; byId("schoolFormMessage").hidden = true;
    const payload = {
      action: "crear-colegio",
      nombre_colegio: byId("newSchoolName").value.trim(),
      slug: byId("newSchoolSlug").value.trim(),
      plan: byId("newSchoolPlan").value,
      nombres: byId("newDirectorNames").value.trim(),
      apellidos: byId("newDirectorLastNames").value.trim(),
      email: byId("newDirectorEmail").value.trim(),
      password: byId("newDirectorPassword").value
    };
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
      console.error("No se pudo registrar el colegio:", error);
      formMessage(error.message || "No se pudo registrar el colegio.");
    } finally { button.disabled = false; }
  });
  byId("logoutButton").addEventListener("click", async () => { await client?.auth.signOut(); window.location.replace(loginPath()); });
  initialize();
})();
