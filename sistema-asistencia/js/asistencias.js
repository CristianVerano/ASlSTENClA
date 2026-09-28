(() => {
  const byId = (id) => document.getElementById(id);
  let app; let records = []; let students = [];
  const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  function setAlert(element, text, type = "error") { element.textContent = text; element.className = `module-alert show ${type}`; }
  function studentOf(record) { return Array.isArray(record.estudiantes) ? record.estudiantes[0] : record.estudiantes; }
  function sectionOf(student) { return Array.isArray(student?.secciones) ? student.secciones[0] : student?.secciones; }
  function gradeOf(section) { return Array.isArray(section?.grados) ? section.grados[0] : section?.grados; }
  function render() {
    const rows = byId("attendanceRows"); rows.replaceChildren();
    const counts = { PRESENTE: 0, TARDANZA: 0, FALTA: 0 };
    records.forEach((record) => { if (counts[record.estado] !== undefined) counts[record.estado] += 1; });
    byId("recordCount").textContent = records.length; byId("presentCount").textContent = counts.PRESENTE; byId("lateCount").textContent = counts.TARDANZA; byId("absenceCount").textContent = counts.FALTA;
    if (!records.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 7; cell.className = "empty-cell"; cell.textContent = "No hay registros con estos filtros."; row.append(cell); rows.append(row); return; }
    records.forEach((record) => {
      const student = studentOf(record); const section = sectionOf(student); const grade = gradeOf(section); const row = document.createElement("tr");
      [record.fecha, [student?.apellidos, student?.nombres].filter(Boolean).join(", ") || "Estudiante", grade ? `${grade.nombre} · ${section?.nombre || ""}` : "—", record.hora_ingreso?.slice(0, 5) || "—"].forEach((value) => { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); });
      const stateCell = document.createElement("td"); const status = document.createElement("select"); status.className = "inline-status"; status.dataset.id = record.id_asistencia; ["PRESENTE", "TARDANZA", "FALTA"].forEach((value) => status.add(new Option(value, value, value === record.estado, value === record.estado))); stateCell.append(status); row.append(stateCell);
      const note = document.createElement("td"); note.textContent = record.observacion || "—"; row.append(note);
      const actionCell = document.createElement("td"); const edit = document.createElement("button"); edit.type = "button"; edit.className = "row-action"; edit.dataset.editId = record.id_asistencia; edit.textContent = "Editar"; actionCell.append(edit); row.append(actionCell);
      rows.append(row);
    });
  }
  async function loadRecords() {
    const query = app.client.from("asistencias").select("id_asistencia,id_estudiante,fecha,hora_ingreso,estado,observacion,estudiantes(nombres,apellidos,codigo,secciones(nombre,grados(nombre,nivel)))").order("fecha", { ascending: false }).order("hora_ingreso", { ascending: false }).limit(10000);
    if (byId("dateFrom").value) query.gte("fecha", byId("dateFrom").value);
    if (byId("dateTo").value) query.lte("fecha", byId("dateTo").value);
    if (byId("attendanceStatus").value) query.eq("estado", byId("attendanceStatus").value);
    const { data, error } = await query;
    if (error) throw error;
    records = data || []; render();
  }
  async function loadStudents() {
    const { data, error } = await app.client.from("estudiantes").select("id_estudiante,codigo,nombres,apellidos,secciones(nombre,grados(nombre))").eq("activo", true).order("apellidos");
    if (error) throw error;
    students = data || [];
    const select = byId("manualStudent"); select.replaceChildren(new Option("Selecciona estudiante", ""));
    students.forEach((student) => { const section = sectionOf(student); const grade = gradeOf(section); select.add(new Option(`${student.apellidos}, ${student.nombres} · ${student.codigo}${grade ? ` · ${grade.nombre} ${section?.nombre || ""}` : ""}`, student.id_estudiante)); });
  }
  function openDialog(record = null) {
    byId("attendanceForm").reset(); byId("attendanceId").value = record?.id_asistencia || "";
    const edit = Boolean(record);
    byId("attendanceDialogTitle").textContent = edit ? "Corregir asistencia" : "Registro manual";
    byId("attendanceDialogHint").textContent = edit ? "Actualiza los datos del registro seleccionado." : "Usa esta opción para anotar un ingreso pendiente.";
    byId("manualStudentWrap").hidden = edit;
    byId("manualStudent").required = !edit;
    byId("manualDate").value = record?.fecha || today();
    byId("manualTime").value = record?.hora_ingreso?.slice(0, 5) || new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    byId("manualStatus").value = record?.estado || "PRESENTE"; byId("manualNote").value = record?.observacion || "";
    byId("saveAttendance").textContent = edit ? "Guardar corrección" : "Guardar registro";
    byId("attendanceFormAlert").className = "module-alert"; byId("attendanceDialog").showModal();
  }
  function downloadCsv() {
    const rows = [["Fecha", "Código", "Estudiante", "Grado", "Sección", "Hora", "Estado", "Observación"], ...records.map((record) => {
      const student = studentOf(record); const section = sectionOf(student); const grade = gradeOf(section);
      return [record.fecha, student?.codigo, `${student?.nombres || ""} ${student?.apellidos || ""}`.trim(), grade?.nombre, section?.nombre, record.hora_ingreso, record.estado, record.observacion || ""];
    })];
    const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `asistencias-${byId("dateFrom").value || "inicio"}-${byId("dateTo").value || "hoy"}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  byId("dateFrom").value = today(); byId("dateTo").value = today();
  byId("applyFilters").addEventListener("click", () => loadRecords().catch(() => setAlert(byId("attendanceAlert"), "No se pudieron consultar las asistencias.")));
  byId("exportAttendance").addEventListener("click", downloadCsv);
  byId("newAttendance").addEventListener("click", () => openDialog());
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => byId(button.dataset.close).close()));
  byId("attendanceRows").addEventListener("change", async (event) => {
    const select = event.target.closest("select.inline-status"); if (!select) return;
    const record = records.find((item) => String(item.id_asistencia) === select.dataset.id); if (!record || record.estado === select.value) return;
    const old = record.estado; const { error } = await app.client.from("asistencias").update({ estado: select.value }).eq("id_asistencia", record.id_asistencia);
    if (error) { select.value = old; setAlert(byId("attendanceAlert"), "No se pudo actualizar el estado. Verifica los permisos de tu rol."); return; }
    await app.logAction("CORREGIR_ASISTENCIA", `${record.fecha} · ${record.id_estudiante}: ${old} → ${select.value}`); record.estado = select.value; render();
    setAlert(byId("attendanceAlert"), "Estado de asistencia actualizado.", "success");
  });
  byId("attendanceRows").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-edit-id]"); if (!button) return;
    const record = records.find((item) => String(item.id_asistencia) === button.dataset.editId); if (record) openDialog(record);
  });
  byId("attendanceForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const id = byId("attendanceId").value;
    const record = { fecha: byId("manualDate").value, hora_ingreso: byId("manualTime").value, estado: byId("manualStatus").value, observacion: byId("manualNote").value.trim() || null };
    if (!id) record.id_estudiante = Number(byId("manualStudent").value);
    const button = byId("saveAttendance"); button.disabled = true;
    try {
      const result = id ? await app.client.from("asistencias").update(record).eq("id_asistencia", id) : await app.client.from("asistencias").insert(record);
      if (result.error) throw result.error;
      await app.logAction(id ? "CORREGIR_ASISTENCIA" : "REGISTRO_MANUAL_ASISTENCIA", `${record.fecha} ${record.hora_ingreso} · ${record.estado}`);
      byId("attendanceDialog").close(); await loadRecords(); setAlert(byId("attendanceAlert"), id ? "Registro corregido." : "Asistencia registrada.", "success");
    } catch (error) { setAlert(byId("attendanceFormAlert"), error.code === "23505" ? "Ese estudiante ya tiene asistencia registrada en esa fecha." : "No se pudo guardar el registro. Revisa la fecha, el estudiante y tus permisos."); }
    finally { button.disabled = false; }
  });
  window.moduleReady.then(async (context) => {
    if (!context) return; app = context;
    try { await Promise.all([loadStudents(), loadRecords()]); }
    catch (error) { console.error(error); setAlert(byId("attendanceAlert"), "No se pudo cargar la información de asistencia."); }
  });
})();
