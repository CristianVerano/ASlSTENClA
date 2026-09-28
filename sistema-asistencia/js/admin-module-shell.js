(() => {
  const { client, getAuthorizedProfile, loginPath } = window.adminAuth || {};
  const path = window.location.pathname;
  const currentPage = path.split("/").pop().replace(".html", "");
  const pages = [
    ["dashboard", "Dashboard", "dashboard.html", "⌂", ["DIRECTOR", "ADMINISTRADOR", "AUXILIAR"]],
    ["estudiantes", "Estudiantes", "estudiantes.html", "♙", ["DIRECTOR", "ADMINISTRADOR"]],
    ["asistencias", "Asistencias", "asistencias.html", "✓", ["DIRECTOR", "ADMINISTRADOR", "AUXILIAR"]],
    ["reportes", "Reportes", "reportes.html", "▥", ["DIRECTOR", "ADMINISTRADOR", "AUXILIAR"]],
    ["configuracion", "Configuración", "configuracion.html", "⚙", ["DIRECTOR"]],
    ["usuarios", "Usuarios y roles", "usuarios.html", "♧", ["DIRECTOR"]],
    ["actividad", "Registro de actividad", "actividad.html", "◷", ["DIRECTOR"]]
  ];

  function mountShell(schoolName, profile) {
    const nav = pages.filter((item) => item[4].includes(profile.role)).map(([id, label, file, icon]) =>
      `<a class="nav-item${id === currentPage ? " active" : ""}" href="${file}"><span class="nav-icon">${icon}</span><span>${label}</span>${id === currentPage ? "<i></i>" : ""}</a>`
    ).join("");
    document.querySelector("#adminSidebar").innerHTML = `
      <a class="sidebar-brand" href="dashboard.html"><span class="sidebar-logo">C</span><span><strong>${escapeHtml(schoolName)}</strong><small>ADMINISTRACIÓN</small></span></a>
      <div class="sidebar-caption">MENÚ PRINCIPAL</div><nav class="sidebar-nav" aria-label="Navegación principal">${nav}</nav>
      <div class="sidebar-bottom"><div class="sidebar-help"><span class="help-icon">?</span><div><strong>Sesión segura</strong><small>${escapeHtml(profile.role.toLocaleLowerCase("es"))}</small></div></div><button id="moduleLogout" class="sidebar-logout" type="button"><span>⇥</span> Cerrar sesión</button></div>`;
    document.querySelector("#adminHeader").innerHTML = `
      <button id="moduleSidebarToggle" class="sidebar-toggle" type="button" aria-label="Abrir menú" aria-expanded="false">☰</button>
      <a class="module-home" href="dashboard.html">Panel de control <span>›</span> <strong>${escapeHtml(document.querySelector("main").dataset.title || "Gestión")}</strong></a>
      <div class="topbar-tools"><span class="topbar-date">${new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><div class="topbar-user"><div class="user-avatar">${escapeHtml(`${profile.nombres?.[0] || ""}${profile.apellidos?.[0] || ""}`.toLocaleUpperCase("es") || "AD")}</div><div class="user-summary"><strong>${escapeHtml([profile.nombres, profile.apellidos].filter(Boolean).join(" ") || "Director")}</strong><span>${escapeHtml(profile.role.toLocaleLowerCase("es"))}</span></div></div></div>`;
    document.querySelector("#moduleLogout").addEventListener("click", async () => {
      await client.auth.signOut();
      window.location.replace(loginPath());
    });
    document.querySelector("#moduleSidebarToggle").addEventListener("click", (event) => {
      const isOpen = document.querySelector("#adminSidebar").classList.toggle("open");
      event.currentTarget.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  async function initialize() {
    if (!client) { window.location.replace(loginPath()); return null; }
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) { window.location.replace(loginPath()); return null; }
    let profile;
    try { profile = await getAuthorizedProfile(session.user.id); }
    catch { window.location.replace(loginPath()); return null; }
    if (!profile) { await client.auth.signOut(); window.location.replace(loginPath()); return null; }
    const allowed = (document.body.dataset.allowedRoles || "DIRECTOR").split(",").map((role) => role.trim());
    if (!allowed.includes(profile.role)) {
      document.querySelector("main").innerHTML = "<section class='module-card'><h1>Acceso restringido</h1><p>Tu rol no permite abrir esta sección.</p><a class='button-link' href='dashboard.html'>Volver al panel</a></section>";
      return null;
    }
    let schoolName = "Mi Colegio";
    const { data: school } = await client.from("configuracion_sistema").select("nombre_colegio,color_principal,color_secundario,color_fondo,modo").order("id_configuracion").limit(1).maybeSingle();
    if (school?.nombre_colegio) schoolName = school.nombre_colegio;
    if (/^#[0-9a-f]{6}$/i.test(school?.color_principal || "")) document.documentElement.style.setProperty("--school-primary", school.color_principal);
    if (/^#[0-9a-f]{6}$/i.test(school?.color_secundario || "")) document.documentElement.style.setProperty("--school-secondary", school.color_secundario);
    if (/^#[0-9a-f]{6}$/i.test(school?.color_fondo || "")) document.documentElement.style.setProperty("--school-background", school.color_fondo);
    document.documentElement.dataset.colorMode = school?.modo || "CLARO";
    mountShell(schoolName, profile);
    return {
      client, session, profile,
      async logAction(action, description) {
        const { error: logError } = await client.from("registro_actividades").insert({ id_usuario: session.user.id, accion: action, descripcion });
        if (logError) console.warn("No se pudo guardar el registro de actividad:", logError.message);
      }
    };
  }

  window.moduleReady = initialize();
})();
