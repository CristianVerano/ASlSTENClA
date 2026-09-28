(() => {
  const ready = window.moduleReady;
  let app;
  let students = [];
  let sections = [];
  let grades = [];

  const byId = (id) => document.getElementById(id);
  function alertBox(element, text, type = "error") { element.textContent = text; element.className = `module-alert show ${type}`; }
  function sectionTitle(section) {
    const grade = Array.isArray(section.grados) ? section.grados[0] : section.grados;
    return `${grade?.nombre || "Grado"} · ${section.nombre}`;
  }
  function fillSections() {
    const formSelect = byId("studentSection");
    const filter = byId("sectionFilter");
    const currentFilter = filter.value;
    formSelect.replaceChildren(new Option("Selecciona un grado y sección", ""));
    filter.replaceChildren(new Option("Todos los grados y secciones", ""));
    sections.forEach((section) => {
      const title = sectionTitle(section);
      const grade = Array.isArray(section.grados) ? section.grados[0] : section.grados;
      if (section.activo && grade?.activo) formSelect.add(new Option(title, section.id_seccion));
      if (section.activo && grade?.activo) filter.add(new Option(title, section.id_seccion));
    });
    filter.value = currentFilter;
  }
  function refreshCounts() {
    byId("activeCount").textContent = students.filter((student) => student.activo).length;
    byId("inactiveCount").textContent = students.filter((student) => !student.activo).length;
    byId("gradeCount").textContent = grades.filter((grade) => grade.activo).length;
    byId("sectionCount").textContent = sections.filter((section) => section.activo).length;
  }
  function renderClassrooms() {
    const gradeRows = byId("gradeRows"); const sectionRows = byId("sectionRows");
    gradeRows.replaceChildren(); sectionRows.replaceChildren();
    grades.forEach((grade) => {
      const row = document.createElement("tr");
      [grade.nombre, grade.nivel, grade.activo ? "Activo" : "Inactivo"].forEach((value, index) => {
        const cell = document.createElement("td"); cell.textContent = value;
        if (index === 2) { const badge = document.createElement("span"); badge.className = `table-status ${grade.activo ? "presente" : "falta"}`; badge.textContent = value; cell.replaceChildren(badge); }
        row.append(cell);
      });
      const actions = document.createElement("td"); actions.className = "row-actions";
      [["edit-grade", "Editar"], ["toggle-grade", grade.activo ? "Desactivar" : "Activar"]].forEach(([action, label]) => { const button = document.createElement("button"); button.type = "button"; button.className = `row-action${action === "toggle-grade" && grade.activo ? " danger" : ""}`; button.dataset.action = action; button.dataset.id = grade.id_grado; button.textContent = label; actions.append(button); });
      row.append(actions); gradeRows.append(row);
    });
    sections.forEach((section) => {
      const grade = Array.isArray(section.grados) ? section.grados[0] : section.grados;
      const row = document.createElement("tr");
      [grade?.nombre || "—", section.nombre, section.activo && grade?.activo ? "Activa" : "Inactiva"].forEach((value, index) => {
        const cell = document.createElement("td"); cell.textContent = value;
        if (index === 2) { const active = section.activo && grade?.activo; const badge = document.createElement("span"); badge.className = `table-status ${active ? "presente" : "falta"}`; badge.textContent = value; cell.replaceChildren(badge); }
        row.append(cell);
      });
      const actions = document.createElement("td"); actions.className = "row-actions";
      [["edit-section", "Editar"], ["toggle-section", section.activo ? "Desactivar" : "Activar"]].forEach(([action, label]) => { const button = document.createElement("button"); button.type = "button"; button.className = `row-action${action === "toggle-section" && section.activo ? " danger" : ""}`; button.dataset.action = action; button.dataset.id = section.id_seccion; button.textContent = label; actions.append(button); });
      row.append(actions); sectionRows.append(row);
    });
    if (!grades.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 4; cell.className = "empty-cell"; cell.textContent = "Todavía no hay grados."; row.append(cell); gradeRows.append(row); }
    if (!sections.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 4; cell.className = "empty-cell"; cell.textContent = "Todavía no hay secciones."; row.append(cell); sectionRows.append(row); }
  }
  function renderRows() {
    const rows = byId("studentsRows");
    const query = byId("studentSearch").value.trim().toLocaleLowerCase("es");
    const status = byId("statusFilter").value;
    const sectionFilter = byId("sectionFilter").value;
    const filtered = students.filter((student) => {
      const matchesQuery = `${student.codigo} ${student.nombres} ${student.apellidos} ${student.dni || ""}`.toLocaleLowerCase("es").includes(query);
      const matchesStatus = status === "TODOS" || (status === "ACTIVOS" ? student.activo : !student.activo);
      return matchesQuery && matchesStatus && (!sectionFilter || String(student.id_seccion) === sectionFilter);
    });
    rows.replaceChildren();
    if (!filtered.length) {
      const row = document.createElement("tr"); const cell = document.createElement("td");
      cell.colSpan = 6; cell.className = "empty-cell"; cell.textContent = "No hay estudiantes que coincidan con estos filtros."; row.append(cell); rows.append(row); return;
    }
    for (const student of filtered) {
      const tr = document.createElement("tr");
      const values = [student.codigo, `${student.apellidos}, ${student.nombres}`, student.dni || "—", sectionTitle(sections.find((section) => section.id_seccion === student.id_seccion) || {}), student.activo ? "Activo" : "Inactivo"];
      values.forEach((value, index) => { const td = document.createElement("td"); td.textContent = value; if (index === 1) td.className = "student-name-cell"; if (index === 4) { const pill = document.createElement("span"); pill.className = `table-status ${student.activo ? "presente" : "falta"}`; pill.textContent = value; td.replaceChildren(pill); } tr.append(td); });
      const actions = document.createElement("td"); actions.className = "row-actions";
      const edit = document.createElement("button"); edit.className = "row-action"; edit.type = "button"; edit.textContent = "Editar"; edit.dataset.action = "edit"; edit.dataset.id = student.id_estudiante;
      const active = document.createElement("button"); active.className = `row-action${student.activo ? " danger" : ""}`; active.type = "button"; active.textContent = student.activo ? "Desactivar" : "Activar"; active.dataset.action = "toggle"; active.dataset.id = student.id_estudiante;
      actions.append(edit, active); tr.append(actions); rows.append(tr);
    }
  }
  async function loadData() {
    const [studentResult, sectionResult, gradeResult] = await Promise.all([
      app.client.from("estudiantes").select("id_estudiante,codigo,nombres,apellidos,dni,id_seccion,fecha_nacimiento,foto_url,activo,fecha_registro").order("apellidos").order("nombres"),
      app.client.from("secciones").select("id_seccion,id_grado,nombre,activo,grados(nombre,nivel,activo)").order("nombre"),
      app.client.from("grados").select("id_grado,nombre,nivel,activo").order("nombre")
    ]);
    const error = studentResult.error || sectionResult.error || gradeResult.error;
    if (error) throw error;
    students = studentResult.data || []; sections = sectionResult.data || []; grades = gradeResult.data || [];
    fillSections(); refreshCounts(); renderRows(); renderClassrooms();
    fillGradeChoices();
  }
  function fillGradeChoices() {
    const select = byId("sectionGrade"); const previous = select.value;
    select.replaceChildren(new Option("Selecciona grado", ""));
    grades.filter((grade) => grade.activo).forEach((grade) => select.add(new Option(`${grade.nombre} · ${grade.nivel.toLocaleLowerCase("es")}`, grade.id_grado)));
    select.value = previous;
  }
  function openStudent(student = null) {
    byId("studentForm").reset(); byId("studentId").value = student?.id_estudiante || "";
    byId("studentDialogTitle").textContent = student ? "Editar estudiante" : "Nuevo estudiante";
    byId("studentCode").value = student?.codigo || ""; byId("studentDni").value = student?.dni || "";
    byId("studentNames").value = student?.nombres || ""; byId("studentLastNames").value = student?.apellidos || "";
    byId("studentSection").value = student?.id_seccion || ""; byId("studentBirth").value = student?.fecha_nacimiento || ""; byId("studentPhoto").value = student?.foto_url || "";
    byId("studentFormAlert").className = "module-alert"; byId("studentDialog").showModal();
  }
  byId("studentSearch").addEventListener("input", renderRows);
  byId("sectionFilter").addEventListener("change", renderRows);
  byId("statusFilter").addEventListener("change", renderRows);
  byId("addStudent").addEventListener("click", () => openStudent());
  byId("openClassrooms").addEventListener("click", () => { byId("classroomAlert").className = "module-alert"; byId("classroomDialog").showModal(); });
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => byId(button.dataset.close).close()));

  byId("studentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = byId("studentId").value;
    const record = { codigo: byId("studentCode").value.trim(), dni: byId("studentDni").value.trim() || null, nombres: byId("studentNames").value.trim(), apellidos: byId("studentLastNames").value.trim(), id_seccion: Number(byId("studentSection").value), fecha_nacimiento: byId("studentBirth").value || null, foto_url: byId("studentPhoto").value.trim() || null };
    const button = byId("saveStudent"); button.disabled = true;
    try {
      const result = id ? await app.client.from("estudiantes").update(record).eq("id_estudiante", id) : await app.client.from("estudiantes").insert(record);
      if (result.error) throw result.error;
      await app.logAction(id ? "ACTUALIZAR_ESTUDIANTE" : "CREAR_ESTUDIANTE", `${record.codigo} · ${record.nombres} ${record.apellidos}`);
      byId("studentDialog").close(); alertBox(byId("studentsAlert"), id ? "Estudiante actualizado." : "Estudiante creado.", "success"); await loadData();
    } catch (error) { alertBox(byId("studentFormAlert"), error.code === "23505" ? "Ese código o DNI ya está registrado." : "No se pudo guardar. Revisa los datos y tus permisos."); }
    finally { button.disabled = false; }
  });

  byId("studentsRows").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const student = students.find((item) => String(item.id_estudiante) === button.dataset.id); if (!student) return;
    if (button.dataset.action === "edit") { openStudent(student); return; }
    const next = !student.activo;
    if (!confirm(`${next ? "¿Activar" : "¿Desactivar"} a ${student.nombres} ${student.apellidos}?`)) return;
    const { error } = await app.client.from("estudiantes").update({ activo: next }).eq("id_estudiante", student.id_estudiante);
    if (error) { alertBox(byId("studentsAlert"), "No se pudo cambiar el estado del estudiante."); return; }
    await app.logAction(next ? "ACTIVAR_ESTUDIANTE" : "DESACTIVAR_ESTUDIANTE", `${student.codigo} · ${student.nombres} ${student.apellidos}`);
    await loadData(); alertBox(byId("studentsAlert"), next ? "Estudiante activado." : "Estudiante desactivado.", "success");
  });

  byId("gradeForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const name = byId("gradeName").value.trim(); const level = byId("gradeLevel").value;
    const { error } = await app.client.from("grados").insert({ nombre: name, nivel: level });
    if (error) { alertBox(byId("classroomAlert"), error.code === "23505" ? "Ya existe un grado con ese nombre." : "No se pudo crear el grado."); return; }
    await app.logAction("CREAR_GRADO", `${name} · ${level}`); byId("gradeForm").reset(); alertBox(byId("classroomAlert"), "Grado creado.", "success"); await loadData();
  });
  byId("sectionForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const idGrade = Number(byId("sectionGrade").value); const name = byId("sectionName").value.trim();
    const { error } = await app.client.from("secciones").insert({ id_grado: idGrade, nombre: name });
    if (error) { alertBox(byId("classroomAlert"), error.code === "23505" ? "Esa sección ya existe en el grado." : "No se pudo crear la sección."); return; }
    await app.logAction("CREAR_SECCION", `${name} · grado ${byId("sectionGrade").selectedOptions[0]?.text}`); byId("sectionForm").reset(); alertBox(byId("classroomAlert"), "Sección creada.", "success"); await loadData();
  });
  async function handleClassroomAction(event, kind) {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const id = Number(button.dataset.id); const action = button.dataset.action;
    if (kind === "grade") {
      const grade = grades.find((item) => item.id_grado === id); if (!grade) return;
      if (action === "edit-grade") {
        const name = prompt("Nombre del grado:", grade.nombre); if (name === null || !name.trim()) return;
        const level = prompt("Nivel (INICIAL, PRIMARIA o SECUNDARIA):", grade.nivel)?.trim().toUpperCase(); if (!level) return;
        if (!["INICIAL", "PRIMARIA", "SECUNDARIA"].includes(level)) { alertBox(byId("classroomAlert"), "El nivel debe ser INICIAL, PRIMARIA o SECUNDARIA."); return; }
        const { error } = await app.client.from("grados").update({ nombre: name.trim(), nivel: level }).eq("id_grado", id);
        if (error) { alertBox(byId("classroomAlert"), "No se pudo actualizar el grado; revisa si el nombre ya existe."); return; }
        await app.logAction("ACTUALIZAR_GRADO", `${grade.nombre} → ${name.trim()} · ${level}`);
      } else {
        const active = !grade.activo; if (!confirm(`${active ? "¿Activar" : "¿Desactivar"} el grado ${grade.nombre}?`)) return;
        const { error } = await app.client.from("grados").update({ activo: active }).eq("id_grado", id);
        if (error) { alertBox(byId("classroomAlert"), "No se pudo cambiar el estado del grado."); return; }
        await app.logAction(active ? "ACTIVAR_GRADO" : "DESACTIVAR_GRADO", grade.nombre);
      }
    } else {
      const section = sections.find((item) => item.id_seccion === id); if (!section) return;
      if (action === "edit-section") {
        const name = prompt("Nombre de la sección:", section.nombre); if (name === null || !name.trim()) return;
        const { error } = await app.client.from("secciones").update({ nombre: name.trim() }).eq("id_seccion", id);
        if (error) { alertBox(byId("classroomAlert"), "No se pudo actualizar la sección; revisa si ya existe dentro del grado."); return; }
        await app.logAction("ACTUALIZAR_SECCION", `${section.nombre} → ${name.trim()}`);
      } else {
        const active = !section.activo; if (!confirm(`${active ? "¿Activar" : "¿Desactivar"} la sección ${section.nombre}?`)) return;
        const { error } = await app.client.from("secciones").update({ activo: active }).eq("id_seccion", id);
        if (error) { alertBox(byId("classroomAlert"), "No se pudo cambiar el estado de la sección."); return; }
        await app.logAction(active ? "ACTIVAR_SECCION" : "DESACTIVAR_SECCION", section.nombre);
      }
    }
    await loadData(); alertBox(byId("classroomAlert"), "Grados y secciones actualizados.", "success");
  }
  byId("gradeRows").addEventListener("click", (event) => handleClassroomAction(event, "grade"));
  byId("sectionRows").addEventListener("click", (event) => handleClassroomAction(event, "section"));

  ready.then((context) => { if (!context) return; app = context; loadData().catch((error) => { console.error(error); alertBox(byId("studentsAlert"), "No se pudo cargar la información. Comprueba tu conexión y el rol de tu cuenta."); }); });
})();
