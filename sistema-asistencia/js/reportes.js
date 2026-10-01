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
  async function exportXlsx() {
    if (!window.ExcelJS) { setAlert("No se pudo cargar el generador Excel. Revisa tu conexión e inténtalo otra vez."); return; }
    const meta = reportMeta(); const workbook = new ExcelJS.Workbook();
    workbook.creator = schoolName; workbook.created = new Date(); workbook.modified = new Date();
    const green = "287E68"; const dark = "173C32"; const pale = "EAF3EF"; const line = "DCE7E1"; const white = "FFFFFF";
    const summarySheet = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
    summarySheet.columns = [{ width: 22 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 17 }];
    summarySheet.mergeCells("A1:G1"); summarySheet.getCell("A1").value = schoolName;
    summarySheet.getCell("A1").font = { name: "Aptos Display", size: 17, bold: true, color: { argb: white } };
    summarySheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: dark } }; summarySheet.getRow(1).height = 32;
    summarySheet.mergeCells("A2:G2"); summarySheet.getCell("A2").value = "Reporte de asistencia";
    summarySheet.getCell("A2").font = { name: "Aptos", size: 13, bold: true, color: { argb: dark } }; summarySheet.getRow(2).height = 25;
    summarySheet.mergeCells("A3:G3"); summarySheet.getCell("A3").value = `Periodo: ${meta.start} al ${meta.end}  ·  Generado: ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(new Date())}`;
    summarySheet.getCell("A3").font = { name: "Aptos", size: 10, color: { argb: "5E7068" } }; summarySheet.getRow(3).height = 20;
    [["A5", "B5"], ["C5", "D5"], ["E5", "F5"]].forEach(([start, end]) => summarySheet.mergeCells(`${start}:${end}`));
    [["A6", "B6"], ["C6", "D6"], ["E6", "F6"]].forEach(([start, end]) => summarySheet.mergeCells(`${start}:${end}`));
    [["A5", "REGISTROS", shownRows.length], ["C5", "PRESENTES", meta.totals.PRESENTE || 0], ["E5", "TARDANZAS", meta.totals.TARDANZA || 0], ["G5", "FALTAS", meta.totals.FALTA || 0]].forEach(([cell, label, value]) => {
      const column = cell[0]; const labelCell = summarySheet.getCell(cell); labelCell.value = label; labelCell.alignment = { horizontal: "center" };
      labelCell.font = { name: "Aptos", size: 9, bold: true, color: { argb: white } }; labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } };
      const valueCell = summarySheet.getCell(`${column}6`); valueCell.value = value; valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.font = { name: "Aptos Display", size: 20, bold: true, color: { argb: dark } }; valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: pale } };
      if (column !== "G") { const next = String.fromCharCode(column.charCodeAt(0) + 1); summarySheet.getCell(`${next}5`).fill = labelCell.fill; summarySheet.getCell(`${next}6`).fill = valueCell.fill; }
    });
    summarySheet.getRow(5).height = 21; summarySheet.getRow(6).height = 36;
    summarySheet.mergeCells("A8:G8"); summarySheet.getCell("A8").value = "Filtros aplicados"; summarySheet.getCell("A8").font = { name: "Aptos", size: 11, bold: true, color: { argb: dark } };
    const filterRow = summarySheet.addRow(["Grado", meta.grade, "Sección", meta.section, "Estado", meta.state]);
    filterRow.eachCell((cell, column) => { cell.border = { bottom: { style: "thin", color: line } }; cell.font = { name: "Aptos", size: 10, bold: column % 2 === 1, color: { argb: column % 2 === 1 ? dark : "41554C" } }; });
    summarySheet.addRow([]); const sectionTitle = summarySheet.addRow(["Resumen por grado y sección"]); summarySheet.mergeCells(`A${sectionTitle.number}:G${sectionTitle.number}`); sectionTitle.getCell(1).font = { name: "Aptos", size: 11, bold: true, color: { argb: dark } };
    const summaryHeader = summarySheet.addRow(["Grado", "Sección", "Registros", "Presentes", "Tardanzas", "Faltas", "% a tiempo"]);
    summaryHeader.height = 23; summaryHeader.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } }; cell.font = { name: "Aptos", size: 9, bold: true, color: { argb: white } }; cell.alignment = { vertical: "middle", horizontal: "center" }; });
    groups.forEach((group, index) => {
      const row = summarySheet.addRow([group.grade, group.section, group.total, group.PRESENTE, group.TARDANZA, group.FALTA, group.total ? group.PRESENTE / group.total : 0]);
      row.getCell(7).numFmt = "0%"; row.eachCell((cell, column) => { cell.font = { name: "Aptos", size: 10, color: { argb: dark } }; cell.border = { bottom: { style: "hair", color: line } }; if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F5F8F6" } }; if (column > 2) cell.alignment = { horizontal: "center" }; });
    });
    summarySheet.views = [{ state: "frozen", ySplit: summaryHeader.number, topLeftCell: `A${summaryHeader.number + 1}`, showGridLines: false }];
    summarySheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    const detailSheet = workbook.addWorksheet("Detalle", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
    detailSheet.columns = [{ header: "Fecha", key: "fecha", width: 15 }, { header: "Código", key: "codigo", width: 15 }, { header: "Apellidos", key: "apellidos", width: 25 }, { header: "Nombres", key: "nombres", width: 25 }, { header: "Grado", key: "grado", width: 17 }, { header: "Sección", key: "seccion", width: 13 }, { header: "Hora", key: "hora", width: 11 }, { header: "Estado", key: "estado", width: 16 }, { header: "Observación", key: "observacion", width: 40 }];
    detailSheet.autoFilter = { from: "A1", to: "I1" }; detailSheet.getRow(1).height = 25;
    detailSheet.getRow(1).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } }; cell.font = { name: "Aptos", size: 9, bold: true, color: { argb: white } }; cell.alignment = { vertical: "middle", horizontal: "center" }; });
    shownRows.forEach((record, index) => {
      const { student, section, grade } = getRelations(record);
      const row = detailSheet.addRow({ fecha: record.fecha ? new Date(`${record.fecha}T12:00:00`) : "", codigo: student?.codigo || "", apellidos: student?.apellidos || "", nombres: student?.nombres || "", grado: grade?.nombre || "Sin grado", seccion: section?.nombre || "Sin sección", hora: record.hora_ingreso?.slice(0, 5) || "", estado: record.estado, observacion: record.observacion || "" });
      row.getCell(1).numFmt = "dd/mm/yyyy";
      row.eachCell((cell) => { cell.font = { name: "Aptos", size: 10, color: { argb: dark } }; cell.border = { bottom: { style: "hair", color: line } }; if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F5F8F6" } }; });
      const state = row.getCell(8); const statusColors = { PRESENTE: ["E8F4E8", "2F6C3C"], TARDANZA: ["FFF3D9", "93610A"], FALTA: ["FCE9E7", "A13B2D"] }[record.estado];
      if (statusColors) { state.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColors[0] } }; state.font = { name: "Aptos", size: 10, bold: true, color: { argb: statusColors[1] } }; }
    });
    detailSheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename("xlsx"); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  byId("generateReport").addEventListener("click", generate); byId("exportCsv").addEventListener("click", exportCsv); byId("exportXlsx").addEventListener("click", () => exportXlsx().catch((error) => { console.error("No se pudo preparar el archivo Excel:", error); setAlert("No se pudo preparar el Excel. Intenta exportar el reporte nuevamente."); })); byId("exportPdf").addEventListener("click", exportPdf);
  byId("reportGrade").addEventListener("change", async () => { try { await loadSections(); await generate(); } catch (error) { console.error(error); setAlert("No se pudieron cargar las secciones."); } });
  byId("reportSection").addEventListener("change", generate); byId("reportState").addEventListener("change", generate);
  window.moduleReady.then(async (context) => { if (!context) return; app = context; try { await Promise.all([loadSchool(), loadGrades()]); await applyUrlFilters(); await generate(); } catch (error) { console.error(error); setAlert("No se pudo inicializar el reporte."); } });
})();
