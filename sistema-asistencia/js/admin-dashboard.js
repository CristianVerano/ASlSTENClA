(() => {
  const { client, getAuthorizedProfile, loginPath } = window.adminAuth || {};
  const lime = "America/Lima";
  let classroomSections = [];

  function isoDateInLima(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: lime, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  function dateDaysBefore(isoDate, days) {
    const date = new Date(`${isoDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  }

  function putText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function showDashboardError(text) {
    const message = document.querySelector("#dashboardMessage");
    message.textContent = text;
    message.hidden = false;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("es-PE").format(value);
  }

  function renderWeeklyChart(attendance, today, range, gradeId, sectionId) {
    const chart = document.querySelector("#weeklyChart");
    const counts = new Map(); attendance.forEach((record) => counts.set(record.fecha, (counts.get(record.fecha) || 0) + 1));
    const days = Array.from({ length: range }, (_, index) => { const date = dateDaysBefore(today, range - 1 - index); const dayName = range <= 7 ? new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", weekday: "short" }).format(new Date(`${date}T12:00:00Z`)).replace(".", "") : `${date.slice(8, 10)}/${date.slice(5, 7)}`; return { date, count: counts.get(date) || 0, dayName, isToday: date === today }; });
    const max = Math.max(1, ...days.map((day) => day.count));
    chart.replaceChildren(); chart.style.gridTemplateColumns = `repeat(${days.length}, minmax(30px, 1fr))`; chart.style.width = `${Math.max(100, days.length * 34)}px`;
    for (const day of days) {
      const column = document.createElement("div");
      column.className = `week-column${day.isToday ? " today" : ""}`;
      column.tabIndex = 0; column.setAttribute("role", "link"); column.setAttribute("aria-label", `Abrir reporte del ${day.date}: ${day.count} registros`); column.title = "Abrir el detalle de este día";
      const value = document.createElement("span");
      value.className = "week-value";
      value.textContent = formatNumber(day.count);
      const track = document.createElement("div");
      track.className = "week-track";
      const bar = document.createElement("span");
      bar.style.height = `${day.count ? Math.max(7, (day.count / max) * 100) : 2}%`;
      track.append(bar);
      const label = document.createElement("span");
      label.className = "week-label";
      label.textContent = day.dayName;
      column.append(value, track, label);
      const openDayReport = () => { const params = new URLSearchParams({ desde: day.date, hasta: day.date }); if (gradeId) params.set("grado", gradeId); if (sectionId) params.set("seccion", sectionId); window.location.href = `reportes.html?${params}`; };
      column.addEventListener("click", openDayReport); column.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDayReport(); } });
      chart.append(column);
    }
  }

  function renderRecent(records) {
    const rows = document.querySelector("#recentRows");
    rows.replaceChildren();
    if (!records.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.className = "empty-row";
      cell.textContent = "Todavía no hay asistencias registradas.";
      row.append(cell);
      rows.append(row);
      return;
    }

    for (const record of records) {
      const student = Array.isArray(record.estudiantes) ? record.estudiantes[0] : record.estudiantes;
      const section = Array.isArray(student?.secciones) ? student.secciones[0] : student?.secciones;
      const grade = Array.isArray(section?.grados) ? section.grados[0] : section?.grados;
      const row = document.createElement("tr");
      const studentCell = document.createElement("td");
      const studentInfo = document.createElement("div");
      studentInfo.className = "table-student";
      const avatar = document.createElement("span");
      avatar.className = "table-avatar";
      avatar.textContent = `${student?.nombres?.[0] || "E"}${student?.apellidos?.[0] || ""}`.toLocaleUpperCase("es");
      const nameWrap = document.createElement("span");
      nameWrap.className = "table-name-wrap";
      const name = document.createElement("strong");
      name.textContent = [student?.nombres, student?.apellidos].filter(Boolean).join(" ") || "Estudiante";
      const code = document.createElement("small");
      code.textContent = student?.codigo || "";
      nameWrap.append(name, code);
      studentInfo.append(avatar, nameWrap);
      studentCell.append(studentInfo);

      const gradeCell = document.createElement("td");
      gradeCell.textContent = grade ? `${grade.nombre} · ${section?.nombre || ""}` : "—";
      const timeCell = document.createElement("td");
      timeCell.textContent = record.hora_ingreso?.slice(0, 5) || "—";
      const stateCell = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = `table-status ${record.estado.toLowerCase()}`;
      pill.textContent = record.estado;
      stateCell.append(pill);
      row.append(studentCell, gradeCell, timeCell, stateCell);
      rows.append(row);
    }
  }

  function renderMetrics(attendance, students, start, today) {
    const present = attendance.filter((record) => record.estado === "PRESENTE").length;
    const late = attendance.filter((record) => record.estado === "TARDANZA").length;
    const absent = attendance.filter((record) => record.estado === "FALTA").length;
    const registered = present + late + absent;
    const enrollment = students || 0;
    const coveredStudents = new Set(attendance.map((record) => {
      const student = Array.isArray(record.estudiantes) ? record.estudiantes[0] : record.estudiantes;
      return student?.id_estudiante;
    }).filter(Boolean)).size;
    const registeredPercent = enrollment ? Math.min(100, Math.round((coveredStudents / enrollment) * 100)) : 0;
    const presentPercent = registered ? Math.round((present / registered) * 100) : 0;

    putText("#todayCount", formatNumber(registered));
    putText("#studentCount", formatNumber(enrollment));
    putText("#presentCount", formatNumber(present));
    putText("#lateCount", formatNumber(late));
    putText("#presentFoot", `${presentPercent}% de los registros del periodo`);
    putText("#lateFoot", `${formatNumber(late)} tardanza${late === 1 ? "" : "s"} en el periodo`);
    putText("#periodFoot", `${start} a ${today}`);
    putText("#legendPresent", formatNumber(present));
    putText("#legendLate", formatNumber(late));
    putText("#legendAbsent", formatNumber(absent));
    putText("#attendanceRate", `${presentPercent}%`);
    putText("#attendancePercent", `${registeredPercent}%`);
    putText("#insightText", enrollment ? `${formatNumber(coveredStudents)} de ${formatNumber(enrollment)} estudiantes registraron asistencia en el periodo.` : "Agrega estudiantes para comenzar a ver el resumen.");
    document.querySelector("#attendanceProgress").style.width = `${registeredPercent}%`;
    const presentArc = registered ? (present / registered) * 100 : 0;
    const lateArc = registered ? (late / registered) * 100 : 0;
    const lateEnd = presentArc + lateArc;
    document.querySelector("#statusDonut").style.background = registered
      ? `conic-gradient(#72b77a 0% ${presentArc}%, #f0b64f ${presentArc}% ${lateEnd}%, #a8a4cf ${lateEnd}% 100%)`
      : "conic-gradient(#e8ede7 0% 100%)";
  }

  async function loadDashboard() {
    const today = isoDateInLima();
    const range = Number(document.querySelector("#dashboardRange").value || 7); const start = dateDaysBefore(today, range - 1);
    const gradeId = document.querySelector("#dashboardGrade").value; const sectionId = document.querySelector("#dashboardSection").value;
    putText("#todayLabel", new Intl.DateTimeFormat("es-PE", { timeZone: lime, weekday: "long", day: "numeric", month: "long" }).format(new Date()));
    putText("#year", new Intl.DateTimeFormat("es-PE", { timeZone: lime, year: "numeric" }).format(new Date()));
    putText("#dashboardPeriodLabel", `Resumen del ${start} al ${today}. Pulsa una columna para abrir su detalle.`); putText("#chartPeriodLabel", `${range} días · pulsa una barra para abrir el reporte de esa fecha`);

    const [studentsResult, attendanceResult] = await Promise.all([
      client.from("estudiantes").select("id_estudiante,id_seccion,secciones(id_grado)").eq("activo", true).limit(20000),
      client.from("asistencias").select("id_asistencia,fecha,hora_ingreso,estado,estudiantes(id_estudiante,nombres,apellidos,codigo,secciones(id_seccion,id_grado,nombre,grados(nombre,nivel)))").gte("fecha", start).lte("fecha", today).order("fecha", { ascending: true }).limit(20000)
    ]);
    const failed = [studentsResult.error, attendanceResult.error].find(Boolean);
    if (failed) throw failed;
    document.querySelector("#dashboardMessage").hidden = true;
    const selectedStudents = studentsResult.data || []; const enrollment = selectedStudents.filter((student) => { const section = Array.isArray(student.secciones) ? student.secciones[0] : student.secciones; return (!gradeId || String(section?.id_grado) === gradeId) && (!sectionId || String(student.id_seccion) === sectionId); });
    const attendance = (attendanceResult.data || []).filter((record) => { const student = Array.isArray(record.estudiantes) ? record.estudiantes[0] : record.estudiantes; const section = Array.isArray(student?.secciones) ? student.secciones[0] : student?.secciones; return (!gradeId || String(section?.id_grado) === gradeId) && (!sectionId || String(section?.id_seccion) === sectionId); });
    renderMetrics(attendance, enrollment.length, start, today);
    renderWeeklyChart(attendance, today, range, gradeId, sectionId);
    const latest = [...attendance].sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.hora_ingreso).localeCompare(String(a.hora_ingreso))).slice(0, 5);
    renderRecent(latest);
  }

  async function loadDashboardFilters() {
    const gradeSelect = document.querySelector("#dashboardGrade");
    const sectionSelect = document.querySelector("#dashboardSection");
    const [gradesResult, sectionsResult] = await Promise.all([
      client.from("grados").select("id_grado,nombre,activo").eq("activo", true).order("nombre"),
      client.from("secciones").select("id_seccion,nombre,id_grado,activo").eq("activo", true).order("nombre")
    ]);
    const failed = gradesResult.error || sectionsResult.error;
    if (failed) throw failed;
    classroomSections = sectionsResult.data || [];
    for (const grade of gradesResult.data || []) {
      const option = document.createElement("option");
      option.value = grade.id_grado;
      option.textContent = grade.nombre;
      gradeSelect.append(option);
    }
    const fillSections = () => {
      const selected = sectionSelect.value;
      sectionSelect.replaceChildren(new Option("Todas", ""));
      const gradeId = gradeSelect.value;
      classroomSections.filter((section) => !gradeId || String(section.id_grado) === gradeId).forEach((section) => {
        const option = document.createElement("option");
        option.value = section.id_seccion;
        option.textContent = section.nombre;
        sectionSelect.append(option);
      });
      if ([...sectionSelect.options].some((option) => option.value === selected)) sectionSelect.value = selected;
    };
    gradeSelect.addEventListener("change", () => { fillSections(); loadDashboard().catch(handleLoadError); });
    sectionSelect.addEventListener("change", () => loadDashboard().catch(handleLoadError));
    document.querySelector("#dashboardRange").addEventListener("change", () => loadDashboard().catch(handleLoadError));
    fillSections();
  }

  function handleLoadError(error) {
    console.error("No se pudo actualizar el dashboard:", error);
    showDashboardError("No pudimos actualizar los indicadores. Revisa tu conexión e inténtalo de nuevo.");
  }

  async function protectAndLoad() {
    if (!client) return window.location.replace(loginPath());
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return window.location.replace(loginPath());

    try {
      const profile = await getAuthorizedProfile(session.user.id);
      if (!profile) {
        await client.auth.signOut();
        return window.location.replace(loginPath());
      }
      if (profile.requiereCambioContrasena) return window.location.replace("cambiar-contrasena.html");
      if (profile.role === "SUPERADMIN") return window.location.replace("../superadmin/login.html");
      const name = [profile.nombres, profile.apellidos].filter(Boolean).join(" ") || session.user.email;
      putText("#userName", name);
      putText("#welcomeName", profile.nombres || "bienvenido");
      putText("#userRole", profile.role.toLocaleLowerCase("es"));
      putText("#userInitials", `${profile.nombres?.[0] || ""}${profile.apellidos?.[0] || ""}`.toLocaleUpperCase("es") || "AD");
      document.querySelectorAll(".dashboard-sidebar [data-roles]").forEach((link) => {
        if (!link.dataset.roles.split(",").includes(profile.role)) link.remove();
      });
      const { data: school } = await client.from("configuracion_sistema").select("nombre_colegio,color_principal,color_secundario,color_fondo,modo").order("id_configuracion").limit(1).maybeSingle();
      if (school) {
        document.documentElement.dataset.colorMode = school.modo || "CLARO";
        putText("#nombreColegio", school.nombre_colegio || "Mi Colegio");
        putText("#footerSchool", school.nombre_colegio || "Mi Colegio");
        document.title = `Dashboard | ${school.nombre_colegio || "Mi Colegio"}`;
        if (/^#[0-9a-f]{6}$/i.test(school.color_principal || "")) document.documentElement.style.setProperty("--school-primary", school.color_principal);
        if (/^#[0-9a-f]{6}$/i.test(school.color_secundario || "")) document.documentElement.style.setProperty("--school-secondary", school.color_secundario);
        if (/^#[0-9a-f]{6}$/i.test(school.color_fondo || "")) document.documentElement.style.setProperty("--school-background", school.color_fondo);
      }
      await loadDashboardFilters();
      await loadDashboard();
    } catch (error) {
      handleLoadError(error);
    }
  }

  document.querySelector("#logoutButton").addEventListener("click", async () => {
    const button = document.querySelector("#logoutButton");
    button.disabled = true;
    await client?.auth.signOut();
    window.location.replace(loginPath());
  });

  document.querySelector("#dashboardSearch").addEventListener("submit", (event) => event.preventDefault());
  document.querySelectorAll('a[aria-disabled="true"]').forEach((link) => {
    link.addEventListener("click", (event) => event.preventDefault());
  });
  document.querySelector("#searchInput").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLocaleLowerCase("es");
    document.querySelectorAll("#recentRows tr").forEach((row) => {
      row.hidden = query && !row.textContent.toLocaleLowerCase("es").includes(query);
    });
  });
  document.querySelector("#sidebarToggle").addEventListener("click", (event) => {
    const sidebar = document.querySelector("#dashboardSidebar");
    const isOpen = sidebar.classList.toggle("open");
    event.currentTarget.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.querySelector("#searchInput").focus();
    }
  });

  protectAndLoad();
})();
