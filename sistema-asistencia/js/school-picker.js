(() => {
  const picker = document.querySelector("#selectorColegios");
  const attendance = document.querySelector("#inicio");
  const list = document.querySelector("#listaColegios");
  const alert = document.querySelector("#selectorMensaje");
  const params = new URLSearchParams(window.location.search);
  const requestedSlug = params.get("colegio")?.trim().toLowerCase() || "";
  const client = window.supabase?.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  function showError(message) {
    alert.textContent = message;
    alert.className = "message error";
    alert.hidden = false;
  }

  function renderSchools(schools) {
    list.replaceChildren();
    if (!schools.length) {
      const empty = document.createElement("p");
      empty.className = "school-picker-loading";
      empty.textContent = "Todavía no hay colegios disponibles.";
      list.append(empty);
      return;
    }
    schools.forEach((school) => {
      const card = document.createElement("article");
      card.className = "school-choice-card";
      const mark = document.createElement("span");
      mark.className = "school-choice-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = school.nombre.slice(0, 1).toLocaleUpperCase("es");
      const copy = document.createElement("div");
      copy.className = "school-choice-copy";
      const title = document.createElement("h2");
      title.textContent = school.nombre;
      const sub = document.createElement("p");
      sub.textContent = "Control de asistencia";
      copy.append(title, sub);
      const link = document.createElement("a");
      link.className = "school-choice-link";
      link.href = `?colegio=${encodeURIComponent(school.slug)}`;
      link.textContent = "Abrir asistencia";
      link.setAttribute("aria-label", `Abrir asistencia de ${school.nombre}`);
      card.append(mark, copy, link);
      list.append(card);
    });
  }

  async function initialize() {
    picker.hidden = true;
    attendance.hidden = true;
    if (!client) {
      picker.hidden = false;
      list.replaceChildren();
      showError("No se pudo conectar con la plataforma. Intenta recargar la página.");
      return null;
    }
    const { data, error } = await client.rpc("listar_colegios_publicos");
    if (error) {
      picker.hidden = false;
      list.replaceChildren();
      showError("No se pudo cargar la lista de colegios. Intenta recargar la página.");
      return null;
    }
    const schools = data || [];
    if (!requestedSlug) {
      picker.hidden = false;
      renderSchools(schools);
      return null;
    }
    const selected = schools.find((school) => school.slug === requestedSlug);
    if (!selected) {
      picker.hidden = false;
      renderSchools(schools);
      showError("No encontramos ese colegio o no está habilitado. Selecciona uno de la lista.");
      window.history.replaceState({}, "", window.location.pathname);
      return null;
    }
    window.selectedSchool = selected;
    attendance.hidden = false;
    document.querySelector("#colegioSeleccionado").textContent = selected.nombre;
    document.querySelector("#accesoAdministrativo").href = `pages/admin/login.html?colegio=${encodeURIComponent(selected.slug)}`;
    return selected;
  }

  window.schoolReady = initialize().catch((error) => {
    console.error("No se pudo preparar la pantalla de asistencia:", error);
    picker.hidden = false;
    attendance.hidden = true;
    showError("Ocurrió un error al cargar los colegios. Intenta nuevamente.");
    return null;
  });
})();
