(() => {
  const byId = (id) => document.getElementById(id);
  let app; let students = []; let sections = []; let grades = []; let attendance = []; let holidays = new Set(); let workDays = [1, 2, 3, 4, 5]; let absenceTime = "08:30";
  const todayLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const addDays = (iso, amount) => { const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); };
  const mondayOf = (iso) => { const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); return addDays(iso, dow === 0 ? -6 : 1 - dow); };
  const datesOfWeek = () => Array.from({ length: 7 }, (_, index) => addDays(byId("weekStart").value, index));
  function alertMessage(text, kind = "error") { byId("weeklyAlert").textContent = text; byId("weeklyAlert").className = `module-alert show ${kind}`; }
  async function fetchAll(makeQuery) {
    const rows = []; const size = 1000;
    for (let from = 0; ; from += size) { const { data, error } = await makeQuery().range(from, from + size - 1); if (error) throw error; rows.push(...(data || [])); if (!data || data.length < size) break; }
    return rows;
  }
  function gradeFor(section) { return Array.isArray(section.grados) ? section.grados[0] : section.grados; }
  function fillFilters() {
    const gradeSelect = byId("weeklyGrade"); const sectionSelect = byId("weeklySection"); const currentGrade = gradeSelect.value; const currentSection = sectionSelect.value;
    gradeSelect.replaceChildren(new Option("Todos los grados", "")); grades.filter((grade) => grade.activo).forEach((grade) => gradeSelect.add(new Option(grade.nombre, grade.id_grado)));
    gradeSelect.value = currentGrade; fillSectionFilter(currentSection);
  }
  function fillSectionFilter(previous = "") {
    const select = byId("weeklySection"); select.replaceChildren(new Option("Todas las secciones", ""));
    sections.filter((section) => section.activo && gradeFor(section)?.activo && (!byId("weeklyGrade").value || String(section.id_grado) === byId("weeklyGrade").value)).forEach((section) => {
      const grade = gradeFor(section); select.add(new Option(`${grade?.nombre || "Grado"} · ${section.nombre}`, section.id_seccion));
    });
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
  function stateFor(student, date) {
    if (holidays.has(date) || !workDays.includes(new Date(`${date}T12:00:00Z`).getUTCDay())) return "SIN_CLASES";
    const found = attendance.find((item) => String(item.id_estudiante) === String(student.id_estudiante) && item.fecha === date);
    if (found) return found.estado;
    const today = todayLima(); if (date > today) return "FUTURO"; if (date < today) return "FALTA_CALCULADA";
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
    return time >= absenceTime ? "FALTA_CALCULADA" : "PENDIENTE";
  }
  function visibleStudents() {
    const query = byId("weeklySearch").value.trim().toLocaleLowerCase("es"); const active = byId("weeklyActive").value;
    return students.filter((student) => {
      const section = sections.find((item) => String(item.id_seccion) === String(student.id_seccion)); const matchGrade = !byId("weeklyGrade").value || String(section?.id_grado) === byId("weeklyGrade").value;
      const matchSection = !byId("weeklySection").value || String(student.id_seccion) === byId("weeklySection").value;
      const matchActive = active === "TODOS" || (active === "ACTIVOS" ? student.activo : !student.activo);
      const matchSearch = `${student.codigo} ${student.nombres} ${student.apellidos}`.toLocaleLowerCase("es").includes(query);
      if (!matchGrade || !matchSection || !matchActive || !matchSearch) return false;
      const states = datesOfWeek().map((date) => stateFor(student, date)); const filter = byId("weeklyState").value;
      if (filter === "FALTAS") return states.some((state) => state === "FALTA" || state === "FALTA_CALCULADA");
      if (filter === "TARDANZAS") return states.includes("TARDANZA");
      if (filter === "PRESENTES") return states.includes("PRESENTE");
      if (filter === "PENDIENTES") return states.includes("PENDIENTE") || states.includes("FUTURO");
      return true;
    });
  }
  function render() {
    const dates = datesOfWeek(); const visible = visibleStudents(); const counts = { PRESENTE: 0, TARDANZA: 0, FALTA: 0, PENDIENTE: 0 };
    const head = byId("weeklyHead"); const headerRow = document.createElement("tr");
    ["ESTUDIANTE", ...dates.map((date) => `${new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replace(".", "")} ${date.slice(8)}`)].forEach((label) => { const cell = document.createElement("th"); cell.textContent = label; headerRow.append(cell); }); head.replaceChildren(headerRow);
    const body = byId("weeklyRows"); body.replaceChildren();
    if (!visible.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 8; cell.className = "empty-cell"; cell.textContent = "No hay estudiantes que coincidan con estos filtros."; row.append(cell); body.append(row); }
    visible.forEach((student) => {
      const row = document.createElement("tr"); const name = document.createElement("td"); name.className = "matrix-student"; name.textContent = `${student.apellidos}, ${student.nombres}`; name.title = student.codigo; row.append(name);
      dates.forEach((date) => { const td = document.createElement("td"); const state = stateFor(student, date); if (state === "PRESENTE" || state === "TARDANZA") counts[state] += 1; if (state === "FALTA" || state === "FALTA_CALCULADA") counts.FALTA += 1; if (state === "PENDIENTE") counts.PENDIENTE += 1;
        const mark = document.createElement("span"); mark.className = `attendance-mark ${state.toLowerCase()}`; mark.textContent = ({ PRESENTE: "P", TARDANZA: "T", FALTA: "F", FALTA_CALCULADA: "F", SIN_CLASES: "—", PENDIENTE: "…", FUTURO: "·" })[state];
        mark.title = `${date}: ${state === "FALTA_CALCULADA" ? "Falta (proyectada hasta el cierre)" : state.replaceAll("_", " ")}`; mark.setAttribute("aria-label", mark.title); td.append(mark); row.append(td);
      }); body.append(row);
    });
    byId("weeklyTotal").textContent = visible.length; byId("weeklyPresent").textContent = counts.PRESENTE; byId("weeklyLate").textContent = counts.TARDANZA; byId("weeklyAbsence").textContent = `${counts.FALTA} / ${counts.PENDIENTE}`;
  }
  async function loadWeek() {
    const dates = datesOfWeek();
    const [attendanceRows, holidayRows] = await Promise.all([
      fetchAll(() => app.client.from("asistencias").select("id_estudiante,fecha,estado").gte("fecha", dates[0]).lte("fecha", dates[6]).order("fecha")),
      app.client.from("dias_no_laborables").select("fecha").eq("activo", true).gte("fecha", dates[0]).lte("fecha", dates[6])
    ]);
    attendance = attendanceRows; holidays = new Set((holidayRows.data || []).map((item) => item.fecha)); if (holidayRows.error) throw holidayRows.error; render();
  }
  async function loadBase() {
    const [studentRows, sectionRows, gradeRows, schedule] = await Promise.all([
      fetchAll(() => app.client.from("estudiantes").select("id_estudiante,codigo,nombres,apellidos,id_seccion,activo").order("apellidos")),
      app.client.from("secciones").select("id_seccion,id_grado,nombre,activo,grados(nombre,activo)").order("nombre"),
      app.client.from("grados").select("id_grado,nombre,activo").order("nombre"),
      app.client.from("configuracion_asistencia").select("dias_laborables,hora_falta").eq("activo", true).order("id_configuracion").limit(1).maybeSingle()
    ]);
    if (sectionRows.error || gradeRows.error || schedule.error) throw sectionRows.error || gradeRows.error || schedule.error;
    students = studentRows; sections = sectionRows.data || []; grades = gradeRows.data || []; workDays = schedule.data?.dias_laborables || [1, 2, 3, 4, 5]; absenceTime = schedule.data?.hora_falta?.slice(0, 5) || "08:30";
    fillFilters(); await loadWeek();
  }
  byId("weekStart").value = mondayOf(todayLima());
  byId("weekStart").addEventListener("change", async () => { const normalized = mondayOf(byId("weekStart").value || todayLima()); byId("weekStart").value = normalized; try { await loadWeek(); } catch (error) { console.error(error); alertMessage("No se pudo cargar esa semana."); } });
  byId("previousWeek").addEventListener("click", () => { byId("weekStart").value = addDays(byId("weekStart").value, -7); byId("weekStart").dispatchEvent(new Event("change")); });
  byId("nextWeek").addEventListener("click", () => { byId("weekStart").value = addDays(byId("weekStart").value, 7); byId("weekStart").dispatchEvent(new Event("change")); });
  ["weeklySearch", "weeklySection", "weeklyActive", "weeklyState"].forEach((id) => byId(id).addEventListener(id === "weeklySearch" ? "input" : "change", render));
  byId("weeklyGrade").addEventListener("change", () => { fillSectionFilter(); render(); });
  byId("resetWeeklyFilters").addEventListener("click", () => { byId("weeklySearch").value = ""; byId("weeklyGrade").value = ""; byId("weeklySection").value = ""; byId("weeklyActive").value = "ACTIVOS"; byId("weeklyState").value = "TODOS"; render(); });
  window.moduleReady.then(async (context) => { if (!context) return; app = context; try { await loadBase(); } catch (error) { console.error(error); alertMessage("No se pudo cargar la asistencia semanal. Revisa tu conexión y los permisos."); } });
})();
