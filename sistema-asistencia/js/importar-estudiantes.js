(() => {
  const byId = (id) => document.getElementById(id);
  let app = null;
  let parsedRows = [];
  const MAX_ROWS = 500;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
  const show = (message, kind = "error") => { const alert = byId("importAlert"); alert.textContent = message; alert.className = `module-alert show ${kind}`; };
  const rawText = (cell) => {
    if (cell.value == null) return "";
    const formatted = cell.text?.trim();
    if (formatted) return formatted;
    const value = cell.value;
    if (typeof value === "object" && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    return String(value).trim();
  };
  function dateValue(cell) {
    const value = cell.value;
    if (value == null || value === "") return { value: null, error: null };
    let iso = "";
    if (value instanceof Date && !Number.isNaN(value.valueOf())) iso = value.toISOString().slice(0, 10);
    else if (typeof value === "number" && value > 0) iso = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
    else {
      const text = rawText(cell);
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) iso = text;
      else {
        const match = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
        if (match) iso = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
      }
    }
    if (!iso) return { value: null, error: "Usa AAAA-MM-DD o DD/MM/AAAA en la fecha." };
    const date = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== iso) return { value: null, error: "La fecha de nacimiento no es válida." };
    return { value: iso, error: null };
  }
  async function fetchAllStudents() {
    const rows = []; const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await app.client.from("estudiantes").select("codigo,dni").order("id_estudiante").range(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  }
  function getHeaderMap(worksheet) {
    const aliases = {
      codigo: ["codigo", "codigo estudiante", "codigo del estudiante"],
      nombres: ["nombres", "nombre"],
      apellidos: ["apellidos", "apellido"],
      dni: ["dni", "documento"],
      correo_apoderado: ["correo apoderado", "correo del apoderado", "email apoderado"],
      telefono_apoderado: ["whatsapp apoderado", "telefono apoderado", "telefono del apoderado"],
      acepta_notificaciones: ["consentimiento notificaciones", "autorizacion notificaciones"],
      grado: ["grado"],
      seccion: ["seccion", "seccion"],
      fecha_nacimiento: ["fecha nacimiento", "fecha de nacimiento", "fecha_nacimiento"],
    };
    const headers = new Map();
    worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => headers.set(normalize(rawText(cell)).replaceAll("_", " "), column));
    const columns = {};
    Object.entries(aliases).forEach(([key, choices]) => { columns[key] = choices.map(normalize).map((name) => name.replaceAll("_", " ")).map((name) => headers.get(name)).find(Boolean) || null; });
    return columns;
  }
  function classroomMap(sections) {
    const map = new Map();
    sections.filter((section) => section.activo && (Array.isArray(section.grados) ? section.grados[0] : section.grados)?.activo).forEach((section) => {
      const grade = Array.isArray(section.grados) ? section.grados[0] : section.grados;
      map.set(`${normalize(grade.nombre)}|${normalize(section.nombre)}`, { id: section.id_seccion, label: `${grade.nombre} · ${section.nombre}` });
    });
    return map;
  }
  function parseWorksheet(worksheet, existing, sections) {
    const columns = getHeaderMap(worksheet);
    const required = ["codigo", "nombres", "apellidos", "grado", "seccion"];
    const missing = required.filter((name) => !columns[name]);
    if (missing.length) throw new Error(`Faltan columnas obligatorias: ${missing.join(", ")}. Descarga la plantilla y conserva sus encabezados.`);
    const sectionByKey = classroomMap(sections);
    const codes = new Set(existing.map((row) => normalize(row.codigo)));
    const dnis = new Set(existing.filter((row) => row.dni).map((row) => normalize(row.dni)));
    const fileCodes = new Set(); const fileDnis = new Set(); const result = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const get = (key) => columns[key] ? rawText(row.getCell(columns[key])) : "";
      const record = { codigo: get("codigo"), nombres: get("nombres"), apellidos: get("apellidos"), dni: get("dni"), grado: get("grado"), seccion: get("seccion"), correo_apoderado: get("correo_apoderado"), telefono_apoderado: get("telefono_apoderado"), acepta_notificaciones: get("acepta_notificaciones") };
      const date = columns.fecha_nacimiento ? dateValue(row.getCell(columns.fecha_nacimiento)) : { value: null, error: null };
      if (!Object.values(record).some((value) => value !== "") && !date.value) return;
      const errors = [];
      if (!record.codigo) errors.push("Falta el código."); else if (record.codigo.length > 30) errors.push("El código supera 30 caracteres.");
      if (!record.nombres || record.nombres.length > 100) errors.push("Revisa los nombres (máximo 100 caracteres).");
      if (!record.apellidos || record.apellidos.length > 100) errors.push("Revisa los apellidos (máximo 100 caracteres).");
      if (record.dni && !/^\d{8}$/.test(record.dni)) errors.push("El DNI debe tener 8 dígitos.");
      if (record.dni && record.dni.length > 8) errors.push("Revisa el DNI: debe tener 8 dígitos.");
      if (record.correo_apoderado && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.correo_apoderado)) errors.push("El correo del apoderado no es válido.");
      if (record.telefono_apoderado && !/^\+?[0-9][0-9 ()-]{7,19}$/.test(record.telefono_apoderado)) errors.push("Revisa el número de WhatsApp del apoderado.");
      const consentValue = normalize(record.acepta_notificaciones);
      const consent = ["si", "sí", "true", "1", "acepta", "autorizado"].includes(consentValue);
      if (consent && !record.correo_apoderado && !record.telefono_apoderado) errors.push("El consentimiento requiere correo o WhatsApp del apoderado.");
      if (date.error) errors.push(date.error);
      const section = sectionByKey.get(`${normalize(record.grado)}|${normalize(record.seccion)}`);
      if (!section) errors.push("El grado y la sección no coinciden con un salón activo.");
      const codeKey = normalize(record.codigo);
      if (record.codigo && (codes.has(codeKey) || fileCodes.has(codeKey))) errors.push("El código ya existe en el colegio o se repite en el archivo.");
      if (record.codigo) fileCodes.add(codeKey);
      const dniKey = normalize(record.dni);
      if (record.dni && (dnis.has(dniKey) || fileDnis.has(dniKey))) errors.push("El DNI ya existe en el colegio o se repite en el archivo.");
      if (record.dni) fileDnis.add(dniKey);
      result.push({ rowNumber, ...record, sectionLabel: section?.label || `${record.grado} · ${record.seccion}`, errors, insert: { codigo: record.codigo, nombres: record.nombres, apellidos: record.apellidos, dni: record.dni || null, id_seccion: section?.id || null, fecha_nacimiento: date.value, correo_apoderado: record.correo_apoderado || null, telefono_apoderado: record.telefono_apoderado || null, acepta_notificaciones: consent } });
    });
    if (!result.length) throw new Error("La hoja no contiene filas de estudiantes para importar.");
    if (result.length > MAX_ROWS) throw new Error(`El archivo contiene ${result.length} estudiantes. Divide la carga en archivos de hasta ${MAX_ROWS}.`);
    return result;
  }
  function renderPreview() {
    const card = byId("studentImportPreview"); const body = byId("studentImportRows"); body.replaceChildren(); card.hidden = false;
    const bad = parsedRows.filter((row) => row.errors.length).length; const valid = parsedRows.length - bad;
    byId("studentImportSummary").textContent = `${parsedRows.length} filas · ${valid} listas · ${bad} con errores${bad ? " — corrige el archivo y vuelve a cargarlo" : " — listo para guardar"}`;
    parsedRows.slice(0, 40).forEach((item) => {
      const row = document.createElement("tr");
      [item.rowNumber, item.codigo || "—", `${item.apellidos || ""}${item.apellidos && item.nombres ? ", " : ""}${item.nombres || ""}` || "—", item.sectionLabel || "—"].forEach((value) => { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); });
      const status = document.createElement("td"); status.className = item.errors.length ? "import-row-error" : "import-row-ok"; status.textContent = item.errors.join(" ") || "Lista para importar"; row.append(status); body.append(row);
    });
    byId("studentImportMore").hidden = parsedRows.length <= 40;
    byId("studentImportMore").textContent = parsedRows.length > 40 ? `Se muestran 40 de ${parsedRows.length} filas; se validaron todas.` : "";
    byId("confirmStudentImport").disabled = bad > 0 || valid === 0;
    byId("confirmStudentImport").textContent = bad ? "Corrige los errores para continuar" : `Importar ${valid} estudiantes`;
  }
  async function previewFile(file) {
    parsedRows = []; byId("studentImportPreview").hidden = true; byId("confirmStudentImport").disabled = true;
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return show("El archivo supera el límite de 5 MB.");
    if (!/\.xlsx$/i.test(file.name)) return show("Selecciona un archivo Excel .xlsx.");
    if (!window.ExcelJS) return show("No se pudo cargar el lector Excel. Comprueba tu conexión e inténtalo de nuevo.");
    try {
      show("Leyendo el archivo y comprobando los datos…", "success");
      const [existing, sectionResult] = await Promise.all([
        fetchAllStudents(),
        app.client.from("secciones").select("id_seccion,nombre,id_grado,activo,grados(nombre,activo)").order("nombre"),
      ]);
      if (sectionResult.error) throw sectionResult.error;
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet("Estudiantes") || workbook.worksheets[0];
      if (!worksheet) throw new Error("El archivo no contiene una hoja de cálculo.");
      parsedRows = parseWorksheet(worksheet, existing, sectionResult.data || []);
      renderPreview();
      show(parsedRows.some((row) => row.errors.length) ? "Hay datos por corregir. No se guardará ninguna fila hasta que el archivo esté completo." : "La vista previa está lista para importar.", parsedRows.some((row) => row.errors.length) ? "error" : "success");
    } catch (error) {
      console.error("No se pudo validar la importación:", error);
      show(error.message || "No se pudo leer el archivo. Descarga la plantilla y vuelve a intentarlo.");
    }
  }
  async function downloadTemplate() {
    if (!window.ExcelJS) return show("No se pudo cargar el generador Excel. Comprueba tu conexión.");
    const workbook = new ExcelJS.Workbook(); workbook.creator = "Sistema de asistencia";
    const sheet = workbook.addWorksheet("Estudiantes", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
    sheet.columns = [{ header: "CODIGO", key: "codigo", width: 18 }, { header: "NOMBRES", key: "nombres", width: 25 }, { header: "APELLIDOS", key: "apellidos", width: 28 }, { header: "DNI", key: "dni", width: 14 }, { header: "GRADO", key: "grado", width: 16 }, { header: "SECCION", key: "seccion", width: 15 }, { header: "FECHA_NACIMIENTO", key: "fecha", width: 22 }, { header: "CORREO_APODERADO", key: "correo", width: 28 }, { header: "WHATSAPP_APODERADO", key: "whatsapp", width: 22 }, { header: "CONSENTIMIENTO_NOTIFICACIONES", key: "consentimiento", width: 34 }];
    sheet.getRow(1).height = 26; sheet.getRow(1).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "287E68" } }; cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFF" } }; cell.alignment = { vertical: "middle", horizontal: "center" }; });
    sheet.getColumn("codigo").numFmt = "@"; sheet.getColumn("dni").numFmt = "@"; sheet.getColumn("fecha").numFmt = "dd/mm/yyyy";
    const instructions = workbook.addWorksheet("Instrucciones", { views: [{ showGridLines: false }] });
    instructions.columns = [{ width: 27 }, { width: 88 }];
    instructions.addRows([["Plantilla de estudiantes", "Completa la hoja Estudiantes y conserva los encabezados."], ["Obligatorios", "CODIGO, NOMBRES, APELLIDOS, GRADO y SECCION."], ["Opcionales", "DNI de 8 dígitos, FECHA_NACIMIENTO, CORREO_APODERADO y WHATSAPP_APODERADO."], ["Consentimiento", "Escribe SI solo cuando el apoderado autorizó avisos; sin autorización no se enviarán notificaciones."], ["Grado y sección", "Escribe los nombres tal como aparecen en el panel del colegio."], ["Fecha", "Usa formato de fecha de Excel o DD/MM/AAAA."], ["Límite", "Hasta 500 filas de estudiantes por archivo."], ["Duplicados", "El código y el DNI deben ser únicos dentro del colegio."], ["Importación", "Si una fila tiene errores, corrige el archivo y vuelve a cargarlo. No se guardan cargas parciales."]]);
    instructions.eachRow((row, index) => row.eachCell((cell) => { cell.font = { name: "Aptos", size: 10, bold: index === 1, color: { argb: index === 1 ? "173C32" : "41554C" } }; cell.alignment = { vertical: "top", wrapText: true }; cell.border = { bottom: { style: "thin", color: "DCE7E1" } }; }));
    const buffer = await workbook.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a"); link.href = url; link.download = "plantilla-estudiantes.xlsx"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  byId("downloadStudentTemplate").addEventListener("click", () => downloadTemplate().catch((error) => { console.error(error); show("No se pudo generar la plantilla Excel."); }));
  byId("studentImportFile").addEventListener("change", (event) => previewFile(event.currentTarget.files?.[0]));
  byId("confirmStudentImport").addEventListener("click", async () => {
    const button = byId("confirmStudentImport"); if (!parsedRows.length || parsedRows.some((row) => row.errors.length)) return;
    button.disabled = true; button.textContent = "Guardando estudiantes…";
    try {
      const { error } = await app.client.from("estudiantes").insert(parsedRows.map((row) => row.insert));
      if (error) throw error;
      await app.logAction("IMPORTAR_ESTUDIANTES_MASIVO", `${parsedRows.length} estudiantes`);
      window.location.replace("estudiantes.html?importados=1");
    } catch (error) {
      console.error("No se pudo completar la carga masiva:", error);
      const detail = error.code === "23505" ? "Hay un código o DNI que ya se registró en el colegio. No se guardó ninguna fila; actualiza la vista previa y corrige el archivo." : "No se pudo completar la carga. No se guardó ninguna fila. Revisa los datos y los permisos.";
      show(detail); button.disabled = false; button.textContent = `Importar ${parsedRows.length} estudiantes`;
    }
  });
  window.moduleReady.then((context) => { if (!context) return; app = context; });
})();
