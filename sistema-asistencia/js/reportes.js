(() => {
  const byId = (id) => document.getElementById(id);
  let app; let allRows = []; let shownRows = [];
  const today = () => { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const get = (type) => parts.find((part) => part.type === type).value; return `${get("year")}-${get("month")}-${get("day")}`; };
  function setAlert(text, type = "error") { const el = byId("reportAlert"); el.textContent = text; el.className = `module-alert show ${type}`; }
  function getRelations(record) { const student = Array.isArray(record.estudiantes) ? record.estudiantes[0] : record.estudiantes; const section = Array.isArray(student?.secciones) ? student.secciones[0] : student?.secciones; const grade = Array.isArray(section?.grados) ? section.grados[0] : section?.grados; return { student, section, grade }; }
  async function loadGrades() {
    const { data, error } = await app.client.from("grados").select("id_grado,nombre,nivel").order("nombre"); if (error) throw error;
    const select = byId("reportGrade"); (data || []).forEach((grade) => select.add(new Option(`${grade.nombre} · ${grade.nivel.toLocaleLowerCase("es")}`, grade.id_grado)));
  }
  async function generate() {
    const start = byId("reportFrom").value; const end = byId("reportTo").value;
    if (start && end && start > end) { setAlert("La fecha inicial debe ser anterior a la fecha final."); return; }
    byId("generateReport").disabled = true;
    try {
      let query = app.client.from("asistencias").select("id_asistencia,fecha,hora_ingreso,estado,observacion,estudiantes(codigo,nombres,apellidos,secciones(nombre,id_grado,grados(nombre,nivel)))").order("fecha", { ascending: false }).limit(20000);
      if (start) query = query.gte("fecha", start); if (end) query = query.lte("fecha", end);
      const { data, error } = await query; if (error) throw error;
      allRows = data || [];
      const grade = byId("reportGrade").value;
      shownRows = allRows.filter((row) => !grade || String(getRelations(row).section?.id_grado) === grade);
      render(start, end);
      setAlert("Reporte actualizado.", "success");
    } catch (error) { console.error(error); setAlert("No se pudo generar el reporte. Revisa las fechas y los permisos de tu rol."); }
    finally { byId("generateReport").disabled = false; }
  }
  function render(start, end) {
    const totals = { PRESENTE: 0, TARDANZA: 0, FALTA: 0 };
    shownRows.forEach((row) => { if (totals[row.estado] !== undefined) totals[row.estado] += 1; });
    byId("reportTotal").textContent = shownRows.length; byId("reportPresent").textContent = totals.PRESENTE; byId("reportLate").textContent = totals.TARDANZA; byId("reportAbsent").textContent = totals.FALTA;
    byId("reportPeriodLabel").textContent = `${start || "Desde el inicio"} — ${end || "hasta hoy"} · ${shownRows.length} registros`;
    const groups = new Map();
    for (const row of shownRows) {
      const { section, grade } = getRelations(row); const key = `${grade?.nombre || "Sin grado"}|${section?.nombre || "Sin sección"}`;
      if (!groups.has(key)) groups.set(key, { grade: grade?.nombre || "Sin grado", section: section?.nombre || "Sin sección", total: 0, PRESENTE: 0, TARDANZA: 0, FALTA: 0 });
      const group = groups.get(key); group.total += 1; if (group[row.estado] !== undefined) group[row.estado] += 1;
    }
    const rows = byId("reportRows"); rows.replaceChildren();
    if (!groups.size) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 7; td.className = "empty-cell"; td.textContent = "No hay asistencias para este periodo y filtro."; tr.append(td); rows.append(tr); return; }
    [...groups.values()].sort((a, b) => a.grade.localeCompare(b.grade, "es") || a.section.localeCompare(b.section, "es")).forEach((group) => {
      const tr = document.createElement("tr"); const onTime = group.total ? Math.round((group.PRESENTE / group.total) * 100) : 0;
      [group.grade, group.section, group.total, group.PRESENTE, group.TARDANZA, group.FALTA, `${onTime}%`].forEach((value) => { const td = document.createElement("td"); td.textContent = value; tr.append(td); }); rows.append(tr);
    });
  }
  function exportCsv() {
    const lines = [["Fecha", "Código", "Apellidos", "Nombres", "Grado", "Sección", "Hora", "Estado", "Observación"], ...shownRows.map((row) => { const { student, section, grade } = getRelations(row); return [row.fecha, student?.codigo, student?.apellidos, student?.nombres, grade?.nombre, section?.nombre, row.hora_ingreso, row.estado, row.observacion || ""]; })];
    const content = "\uFEFF" + lines.map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })); link.download = `reporte-asistencia-${byId("reportFrom").value || "inicio"}-${byId("reportTo").value || "hoy"}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  const todayDate = today(); byId("reportTo").value = todayDate; byId("reportFrom").value = `${todayDate.slice(0, 7)}-01`;
  byId("generateReport").addEventListener("click", generate); byId("exportReport").addEventListener("click", exportCsv);
  byId("reportGrade").addEventListener("change", generate);
  window.moduleReady.then(async (context) => { if (!context) return; app = context; try { await loadGrades(); await generate(); } catch (error) { console.error(error); setAlert("No se pudo inicializar el reporte."); } });
})();
