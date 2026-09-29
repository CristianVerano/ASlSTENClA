(() => {
  const byId = (id) => document.getElementById(id);
  let app; let allRows = []; let shownRows = []; let groups = []; let schoolName = "Mi Colegio";
  const today = () => { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const get = (type) => parts.find((part) => part.type === type).value; return `${get("year")}-${get("month")}-${get("day")}`; };
  function setAlert(text, type = "error") { const el = byId("reportAlert"); el.textContent = text; el.className = `module-alert show ${type}`; }
  function getRelations(record) { const student = Array.isArray(record.estudiantes) ? record.estudiantes[0] : record.estudiantes; const section = Array.isArray(student?.secciones) ? student.secciones[0] : student?.secciones; const grade = Array.isArray(section?.grados) ? section.grados[0] : section?.grados; return { student, section, grade }; }
  async function loadGrades() {
    const { data, error } = await app.client.from("grados").select("id_grado,nombre,nivel").order("nombre"); if (error) throw error;
    const select = byId("reportGrade"); (data || []).forEach((grade) => select.add(new Option(`${grade.nombre} · ${grade.nivel.toLocaleLowerCase("es")}`, grade.id_grado)));
  }
  async function loadSections() {
    const select = byId("reportSection"); const previous = select.value; select.replaceChildren(new Option("Todas", ""));
    let query = app.client.from("secciones").select("id_seccion,nombre,id_grado").eq("activo", true).order("nombre");
    if (byId("reportGrade").value) query = query.eq("id_grado", byId("reportGrade").value);
    const { data, error } = await query; if (error) throw error;
    (data || []).forEach((section) => select.add(new Option(section.nombre, section.id_seccion)));
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
  async function loadSchool() {
    const { data, error } = await app.client.from("configuracion_sistema").select("nombre_colegio").order("id_configuracion").limit(1).maybeSingle();
    if (error) throw error; schoolName = data?.nombre_colegio || "Mi Colegio";
  }
  function filteredRows(rows) {
    const gradeId = byId("reportGrade").value; const sectionId = byId("reportSection").value; const state = byId("reportState").value;
    return rows.filter((row) => { const { section } = getRelations(row); return (!gradeId || String(section?.id_grado) === gradeId) && (!sectionId || String(section?.id_seccion) === sectionId) && (!state || row.estado === state); });
  }
  async function generate() {
    const start = byId("reportFrom").value; const end = byId("reportTo").value;
    if (start && end && start > end) { setAlert("La fecha inicial debe ser anterior a la fecha final."); return; }
    byId("generateReport").disabled = true;
    try {
      let query = app.client.from("asistencias").select("id_asistencia,fecha,hora_ingreso,estado,observacion,estudiantes(codigo,nombres,apellidos,secciones(id_seccion,nombre,id_grado,grados(nombre,nivel)))").order("fecha", { ascending: false }).order("hora_ingreso", { ascending: false }).limit(20000);
      if (start) query = query.gte("fecha", start); if (end) query = query.lte("fecha", end);
      const { data, error } = await query; if (error) throw error;
      allRows = data || []; shownRows = filteredRows(allRows); render(start, end); setAlert("Reporte actualizado con los filtros seleccionados.", "success");
    } catch (error) { console.error(error); setAlert("No se pudo generar el reporte. Revisa las fechas y los permisos de tu rol."); }
    finally { byId("generateReport").disabled = false; }
  }
  function render(start, end) {
    const totals = { PRESENTE: 0, TARDANZA: 0, FALTA: 0 };
    shownRows.forEach((row) => { if (totals[row.estado] !== undefined) totals[row.estado] += 1; });
    byId("reportTotal").textContent = shownRows.length; byId("reportPresent").textContent = totals.PRESENTE; byId("reportLate").textContent = totals.TARDANZA; byId("reportAbsent").textContent = totals.FALTA;
    byId("reportPeriodLabel").textContent = `${start || "Desde el inicio"} — ${end || "hasta hoy"} · ${shownRows.length} registros`;
    const grouped = new Map();
    for (const row of shownRows) {
      const { section, grade } = getRelations(row); const gradeName = grade?.nombre || "Sin grado"; const sectionName = section?.nombre || "Sin sección"; const key = `${gradeName}|${sectionName}`;
      if (!grouped.has(key)) grouped.set(key, { grade: gradeName, section: sectionName, total: 0, PRESENTE: 0, TARDANZA: 0, FALTA: 0 });
      const group = grouped.get(key); group.total += 1; if (group[row.estado] !== undefined) group[row.estado] += 1;
    }
    groups = [...grouped.values()].sort((a, b) => a.grade.localeCompare(b.grade, "es") || a.section.localeCompare(b.section, "es"));
    const rows = byId("reportRows"); rows.replaceChildren();
    if (!groups.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 7; td.className = "empty-cell"; td.textContent = "No hay asistencias para este periodo y filtro."; tr.append(td); rows.append(tr); }
    groups.forEach((group) => {
      const tr = document.createElement("tr"); const onTime = group.total ? Math.round((group.PRESENTE / group.total) * 100) : 0;
      [group.grade, group.section, group.total, group.PRESENTE, group.TARDANZA, group.FALTA, `${onTime}%`].forEach((value) => { const td = document.createElement("td"); td.textContent = value; tr.append(td); }); rows.append(tr);
    });
    const detailRows = byId("reportDetailRows"); detailRows.replaceChildren();
    if (!shownRows.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 6; td.className = "empty-cell"; td.textContent = "No hay registros que mostrar."; tr.append(td); detailRows.append(tr); return; }
    shownRows.forEach((row) => {
      const { student, section, grade } = getRelations(row); const tr = document.createElement("tr");
      const values = [row.fecha, [student?.apellidos, student?.nombres].filter(Boolean).join(", ") || "Estudiante", grade ? `${grade.nombre} · ${section?.nombre || ""}` : "—", row.hora_ingreso?.slice(0, 5) || "—", row.estado, row.observacion || "—"];
      values.forEach((value, index) => { const td = document.createElement("td"); td.textContent = value; if (index === 4) { const badge = document.createElement("span"); badge.className = `table-status ${String(value).toLowerCase()}`; badge.textContent = value; td.replaceChildren(badge); } tr.append(td); }); detailRows.append(tr);
    });
  }
  function reportMeta() {
    return { start: byId("reportFrom").value || "Desde el inicio", end: byId("reportTo").value || "Hasta hoy", grade: byId("reportGrade").selectedOptions[0]?.textContent || "Todos", section: byId("reportSection").value ? byId("reportSection").selectedOptions[0]?.textContent : "Todas", state: byId("reportState").value || "Todos", totals: shownRows.reduce((result, row) => { result[row.estado] = (result[row.estado] || 0) + 1; return result; }, {}) };
  }
  function filename(extension) { const start = byId("reportFrom").value || "inicio"; const end = byId("reportTo").value || "hoy"; return `asistencia-${start}-${end}.${extension}`; }
  function exportCsv() {
    const lines = [["Fecha", "Código", "Apellidos", "Nombres", "Grado", "Sección", "Hora", "Estado", "Observación"], ...shownRows.map((row) => { const { student, section, grade } = getRelations(row); return [row.fecha, student?.codigo, student?.apellidos, student?.nombres, grade?.nombre, section?.nombre, row.hora_ingreso, row.estado, row.observacion || ""]; })];
    const content = "\uFEFF" + lines.map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })); link.download = filename("csv"); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function exportXlsx() {
    if (!window.XLSX) { setAlert("No se pudo cargar el generador Excel. Revisa tu conexión e inténtalo otra vez."); return; }
    const meta = reportMeta(); const workbook = XLSX.utils.book_new();
    const summary = [[schoolName], ["REPORTE DE ASISTENCIA"], ["Periodo", meta.start, "al", meta.end], ["Grado", meta.grade, "Sección", meta.section, "Estado", meta.state], [], ["RESUMEN GENERAL"], ["Indicador", "Cantidad"], ["Registros", shownRows.length], ["Presentes", meta.totals.PRESENTE || 0], ["Tardanzas", meta.totals.TARDANZA || 0], ["Faltas registradas", meta.totals.FALTA || 0], [], ["RESUMEN POR GRADO Y SECCIÓN"], ["Grado", "Sección", "Registros", "Presentes", "Tardanzas", "Faltas", "% a tiempo"], ...groups.map((group) => [group.grade, group.section, group.total, group.PRESENTE, group.TARDANZA, group.FALTA, group.total ? `${Math.round(group.PRESENTE / group.total * 100)}%` : "0%"] )];
    const detail = [["Fecha", "Código", "Apellidos", "Nombres", "Grado", "Sección", "Hora", "Estado", "Observación"], ...shownRows.map((row) => { const { student, section, grade } = getRelations(row); return [row.fecha, student?.codigo || "", student?.apellidos || "", student?.nombres || "", grade?.nombre || "Sin grado", section?.nombre || "Sin sección", row.hora_ingreso?.slice(0, 5) || "", row.estado, row.observacion || ""]; })];
    const summarySheet = XLSX.utils.aoa_to_sheet(summary); summarySheet["!cols"] = [{ wch: 24 }, { wch: 19 }, { wch: 14 }, { wch: 19 }, { wch: 14 }, { wch: 18 }, { wch: 17 }];
    const detailSheet = XLSX.utils.aoa_to_sheet(detail); detailSheet["!cols"] = [{ wch: 14 }, { wch: 15 }, { wch: 24 }, { wch: 24 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 40 }]; detailSheet["!autofilter"] = { ref: `A1:I${Math.max(1, detail.length)}` }; detailSheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen"); XLSX.utils.book_append_sheet(workbook, detailSheet, "Detalle"); XLSX.writeFile(workbook, filename("xlsx"));
  }
  function exportPdf() {
    const JsPDF = window.jspdf?.jsPDF;
    if (!JsPDF) { setAlert("No se pudo cargar el generador PDF. Revisa tu conexión e inténtalo otra vez."); return; }
    const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" }); const meta = reportMeta();
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(35, 74, 61); doc.text(schoolName, 14, 15);
    doc.setFontSize(11); doc.text("REPORTE DE ASISTENCIA", 14, 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 105, 97);
    doc.text(`Periodo: ${meta.start} al ${meta.end}   ·   Grado: ${meta.grade}   ·   Sección: ${meta.section}   ·   Estado: ${meta.state}`, 14, 28);
    doc.text(`Generado: ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`, 14, 33);
    doc.autoTable({ startY: 38, head: [["RESUMEN", "REGISTROS", "PRESENTES", "TARDANZAS", "FALTAS"]], body: [["Total del periodo", shownRows.length, meta.totals.PRESENTE || 0, meta.totals.TARDANZA || 0, meta.totals.FALTA || 0]], theme: "grid", styles: { fontSize: 8, cellPadding: 2.5 }, headStyles: { fillColor: [39, 126, 104] } });
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 6, head: [["GRADO", "SECCIÓN", "REGISTROS", "PRESENTES", "TARDANZAS", "FALTAS", "% A TIEMPO"]], body: groups.map((group) => [group.grade, group.section, group.total, group.PRESENTE, group.TARDANZA, group.FALTA, `${group.total ? Math.round(group.PRESENTE / group.total * 100) : 0}%`]), theme: "grid", styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [39, 126, 104] } });
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 7, head: [["FECHA", "CÓDIGO", "ESTUDIANTE", "GRADO / SECCIÓN", "HORA", "ESTADO", "OBSERVACIÓN"]], body: shownRows.map((row) => { const { student, section, grade } = getRelations(row); return [row.fecha, student?.codigo || "", [student?.apellidos, student?.nombres].filter(Boolean).join(", "), grade ? `${grade.nombre} · ${section?.nombre || ""}` : "—", row.hora_ingreso?.slice(0, 5) || "—", row.estado, row.observacion || "—"]; }), theme: "grid", styles: { fontSize: 7, cellPadding: 1.8, overflow: "linebreak" }, headStyles: { fillColor: [39, 126, 104] }, columnStyles: { 6: { cellWidth: 42 } }, didDrawPage: () => { const pages = doc.internal.getNumberOfPages(); doc.setFontSize(7); doc.setTextColor(120, 130, 123); doc.text(`${schoolName} · Página ${pages}`, 283, 202, { align: "right" }); } });
    doc.save(filename("pdf"));
  }
  async function applyUrlFilters() {
    const params = new URLSearchParams(window.location.search); const start = params.get("desde") || params.get("start"); const end = params.get("hasta") || params.get("end");
    if (start) byId("reportFrom").value = start; if (end) byId("reportTo").value = end;
    await loadSections();
    if (params.get("grado")) byId("reportGrade").value = params.get("grado");
    await loadSections();
    if (params.get("seccion")) byId("reportSection").value = params.get("seccion");
    if (params.get("estado")) byId("reportState").value = params.get("estado");
  }
  const todayDate = today(); byId("reportTo").value = todayDate; byId("reportFrom").value = `${todayDate.slice(0, 7)}-01`;
  byId("generateReport").addEventListener("click", generate); byId("exportCsv").addEventListener("click", exportCsv); byId("exportXlsx").addEventListener("click", exportXlsx); byId("exportPdf").addEventListener("click", exportPdf);
  byId("reportGrade").addEventListener("change", async () => { try { await loadSections(); await generate(); } catch (error) { console.error(error); setAlert("No se pudieron cargar las secciones."); } });
  byId("reportSection").addEventListener("change", generate); byId("reportState").addEventListener("change", generate);
  window.moduleReady.then(async (context) => { if (!context) return; app = context; try { await Promise.all([loadSchool(), loadGrades()]); await applyUrlFilters(); await generate(); } catch (error) { console.error(error); setAlert("No se pudo inicializar el reporte."); } });
})();
