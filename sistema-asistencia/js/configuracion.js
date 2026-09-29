(() => {
  const byId = (id) => document.getElementById(id);
  let app; let schoolRow; let scheduleRow; let holidays = [];
  const weekDays = [{ value: 1, label: "Lunes" }, { value: 2, label: "Martes" }, { value: 3, label: "Miércoles" }, { value: 4, label: "Jueves" }, { value: 5, label: "Viernes" }, { value: 6, label: "Sábado" }, { value: 0, label: "Domingo" }];
  const themes = [
    { name: "Azul clásico", primary: "#1766D1", secondary: "#8DB4F3", background: "#F3F6FC" },
    { name: "Azul cielo", primary: "#1F78C8", secondary: "#78C8E8", background: "#F1F8FC" },
    { name: "Índigo", primary: "#415FA8", secondary: "#91ADEC", background: "#F4F6FC" },
    { name: "Pizarra", primary: "#53647E", secondary: "#9AAAC5", background: "#F3F5F8" },
    { name: "Océano", primary: "#087F8C", secondary: "#69C0C3", background: "#F0F8F8" },
    { name: "Turquesa", primary: "#087F73", secondary: "#57D2C3", background: "#EFFAF8" },
    { name: "Bosque", primary: "#287E68", secondary: "#83A847", background: "#F1F6F1" },
    { name: "Oliva", primary: "#526B50", secondary: "#A5C18F", background: "#F4F7F1" },
    { name: "Dorado", primary: "#887000", secondary: "#E4C84E", background: "#FBF8E9" },
    { name: "Terracota", primary: "#A35A24", secondary: "#F1A56E", background: "#FCF5EF" },
    { name: "Cálido", primary: "#87614E", secondary: "#D8B6A3", background: "#FAF5F2" },
    { name: "Rosa", primary: "#9F4D68", secondary: "#F09AB2", background: "#FCF2F5" },
    { name: "Ciruela", primary: "#874A83", secondary: "#E29AD8", background: "#FBF2FA" },
    { name: "Violeta", primary: "#70549B", secondary: "#BDA2EF", background: "#F7F3FC" }
  ];
  function show(text, type = "success") { const alert = byId("settingsAlert"); alert.textContent = text; alert.className = `module-alert show ${type}`; }
  function setColors(row) {
    if (/^#[0-9a-f]{6}$/i.test(row.color_principal || "")) document.documentElement.style.setProperty("--school-primary", row.color_principal);
    if (/^#[0-9a-f]{6}$/i.test(row.color_secundario || "")) document.documentElement.style.setProperty("--school-secondary", row.color_secundario);
    if (/^#[0-9a-f]{6}$/i.test(row.color_fondo || "")) document.documentElement.style.setProperty("--school-background", row.color_fondo);
    document.documentElement.dataset.colorMode = row.modo || "CLARO";
  }
  function paintThemeButtons() {
    const palette = byId("themePalette"); if (!palette) return;
    const current = { primary: byId("schoolPrimary").value.toUpperCase(), secondary: byId("schoolSecondary").value.toUpperCase(), background: byId("schoolBackground").value.toUpperCase() };
    const selected = themes.find((theme) => theme.primary === current.primary && theme.secondary === current.secondary && theme.background === current.background);
    palette.replaceChildren(...themes.map((theme) => {
      const button = document.createElement("button"); button.type = "button"; button.className = `theme-option${selected?.name === theme.name ? " selected" : ""}`; button.setAttribute("aria-pressed", String(selected?.name === theme.name)); button.setAttribute("aria-label", `Usar tema ${theme.name}`); button.title = theme.name;
      const swatch = document.createElement("span"); swatch.className = "theme-swatch"; swatch.style.background = `conic-gradient(${theme.primary} 0 25%, ${theme.secondary} 25% 50%, ${theme.background} 50% 75%, ${theme.primary} 75% 100%)`;
      const label = document.createElement("span"); label.className = "theme-option-name"; label.textContent = theme.name; button.append(swatch, label);
      button.addEventListener("click", () => {
        byId("schoolPrimary").value = theme.primary; byId("schoolSecondary").value = theme.secondary; byId("schoolBackground").value = theme.background; setColors({ color_principal: theme.primary, color_secundario: theme.secondary, color_fondo: theme.background, modo: byId("schoolMode").value }); paintThemeButtons();
        byId("themePreviewLabel").textContent = `Vista previa: ${theme.name}. Guarda los datos del colegio para conservar este tema.`;
      });
      return button;
    }));
  }
  async function loadSchool() {
    const { data, error } = await app.client.from("configuracion_sistema").select("*").order("id_configuracion").limit(1).maybeSingle();
    if (error) throw error; schoolRow = data;
    if (!data) return;
    byId("schoolId").value = data.id_configuracion; byId("schoolName").value = data.nombre_colegio || ""; byId("schoolMotto").value = data.lema || "";
    byId("schoolEmail").value = data.correo || ""; byId("schoolPhone").value = data.telefono || ""; byId("schoolAddress").value = data.direccion || "";
    byId("schoolYear").value = data.anio_academico || ""; byId("schoolLogo").value = data.logo_url || ""; byId("schoolPrimary").value = data.color_principal || "#2563eb";
    byId("schoolSecondary").value = data.color_secundario || "#0ea5e9"; byId("schoolBackground").value = data.color_fondo || "#f8fafc"; byId("schoolMode").value = data.modo || "CLARO"; setColors(data); paintThemeButtons();
  }
  async function loadSchedule() {
    const { data, error } = await app.client.from("configuracion_asistencia").select("*").order("id_configuracion").limit(1).maybeSingle();
    if (error) throw error; scheduleRow = data; if (!data) return;
    byId("scheduleId").value = data.id_configuracion; byId("startTime").value = data.hora_inicio.slice(0, 5); byId("lateTime").value = data.hora_tardanza.slice(0, 5);
    byId("closeTime").value = data.hora_cierre.slice(0, 5); byId("absenceTime").value = data.hora_falta.slice(0, 5);
    const activeDays = data.dias_laborables || [1, 2, 3, 4, 5]; const options = byId("workdayOptions");
    options.replaceChildren(...weekDays.map((day) => { const label = document.createElement("label"); label.className = "workday-option"; const input = document.createElement("input"); input.type = "checkbox"; input.name = "workday"; input.value = day.value; input.checked = activeDays.includes(day.value); const text = document.createElement("span"); text.textContent = day.label; label.append(input, text); return label; }));
  }
  async function loadHolidays() {
    const { data, error } = await app.client.from("dias_no_laborables").select("id_dia,fecha,motivo,activo").order("fecha", { ascending: false });
    if (error) throw error; holidays = data || []; renderHolidays();
  }
  function renderHolidays() {
    const rows = byId("holidayRows"); rows.replaceChildren();
    if (!holidays.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 4; cell.className = "empty-cell"; cell.textContent = "No hay días no laborables configurados."; row.append(cell); rows.append(row); return; }
    holidays.forEach((holiday) => {
      const row = document.createElement("tr"); const date = document.createElement("td"); date.textContent = holiday.fecha; const reason = document.createElement("td"); reason.textContent = holiday.motivo;
      const state = document.createElement("td"); const pill = document.createElement("span"); pill.className = `table-status ${holiday.activo ? "presente" : "falta"}`; pill.textContent = holiday.activo ? "Activo" : "Inactivo"; state.append(pill);
      const actionCell = document.createElement("td"); const button = document.createElement("button"); button.type = "button"; button.className = "row-action"; button.dataset.holiday = holiday.id_dia; button.textContent = holiday.activo ? "Desactivar" : "Reactivar"; actionCell.append(button);
      row.append(date, reason, state, actionCell); rows.append(row);
    });
  }
  byId("schoolForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const button = byId("saveSchool"); button.disabled = true;
    const values = { nombre_colegio: byId("schoolName").value.trim(), lema: byId("schoolMotto").value.trim() || null, correo: byId("schoolEmail").value.trim() || null, telefono: byId("schoolPhone").value.trim() || null, direccion: byId("schoolAddress").value.trim() || null, anio_academico: Number(byId("schoolYear").value), logo_url: byId("schoolLogo").value.trim() || null, color_principal: byId("schoolPrimary").value, color_secundario: byId("schoolSecondary").value, color_fondo: byId("schoolBackground").value, modo: byId("schoolMode").value, fecha_actualizacion: new Date().toISOString() };
    try { const { error } = await app.client.from("configuracion_sistema").update(values).eq("id_configuracion", schoolRow.id_configuracion); if (error) throw error; schoolRow = { ...schoolRow, ...values }; setColors(schoolRow); document.querySelectorAll("#nombreColegio").forEach((node) => node.textContent = values.nombre_colegio); await app.logAction("ACTUALIZAR_CONFIGURACION_COLEGIO", values.nombre_colegio); show("Datos del colegio guardados."); }
    catch (error) { console.error(error); show("No se pudo guardar la configuración. Verifica los campos y tus permisos.", "error"); }
    finally { button.disabled = false; }
  });
  ["schoolPrimary", "schoolSecondary", "schoolBackground"].forEach((id) => byId(id).addEventListener("input", () => {
    setColors({ color_principal: byId("schoolPrimary").value, color_secundario: byId("schoolSecondary").value, color_fondo: byId("schoolBackground").value, modo: byId("schoolMode").value }); paintThemeButtons();
    byId("themePreviewLabel").textContent = "Vista previa personalizada. Guarda los datos del colegio para conservar los cambios.";
  }));
  byId("schoolMode").addEventListener("change", () => setColors({ color_principal: byId("schoolPrimary").value, color_secundario: byId("schoolSecondary").value, color_fondo: byId("schoolBackground").value, modo: byId("schoolMode").value }));
  byId("scheduleForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const button = byId("saveSchedule"); button.disabled = true;
    const values = { hora_inicio: byId("startTime").value, hora_tardanza: byId("lateTime").value, hora_cierre: byId("closeTime").value, hora_falta: byId("absenceTime").value, activo: true, fecha_actualizacion: new Date().toISOString() };
    try { const { error } = await app.client.from("configuracion_asistencia").update(values).eq("id_configuracion", scheduleRow.id_configuracion); if (error) throw error; await app.logAction("ACTUALIZAR_HORARIO_ASISTENCIA", `${values.hora_inicio} · tardanza ${values.hora_tardanza} · cierre ${values.hora_cierre} · falta ${values.hora_falta}`); show("Horarios de asistencia actualizados."); }
    catch (error) { console.error(error); show("No se guardaron los horarios. Verifica que inicio < tardanza ≤ cierre ≤ falta.", "error"); }
    finally { button.disabled = false; }
  });
  byId("workdaysForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const button = byId("saveWorkdays"); const days = [...document.querySelectorAll('input[name="workday"]:checked')].map((input) => Number(input.value));
    if (!days.length) { show("Selecciona por lo menos un día con clases.", "error"); return; }
    button.disabled = true;
    try {
      const { error } = await app.client.from("configuracion_asistencia").update({ dias_laborables: days.sort((a, b) => a - b), fecha_actualizacion: new Date().toISOString() }).eq("id_configuracion", scheduleRow.id_configuracion);
      if (error) throw error;
      scheduleRow.dias_laborables = days; await app.logAction("ACTUALIZAR_DIAS_CON_CLASES", days.map((day) => weekDays.find((item) => item.value === day)?.label).join(", ")); show("Días con clases guardados.");
    } catch (error) { console.error(error); show("No se guardaron los días. Recarga la página e inténtalo de nuevo.", "error"); }
    finally { button.disabled = false; }
  });
  byId("holidayForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const date = byId("holidayDate").value; const reason = byId("holidayReason").value.trim();
    try {
      const existing = holidays.find((item) => item.fecha === date);
      let error;
      if (existing) {
        if (existing.activo) { show("Esa fecha ya está registrada en el calendario.", "error"); return; }
        ({ error } = await app.client.from("dias_no_laborables").update({ activo: true, motivo: reason }).eq("id_dia", existing.id_dia));
      } else ({ error } = await app.client.from("dias_no_laborables").insert({ fecha: date, motivo: reason }));
      if (error) throw error;
      await app.logAction("ACTUALIZAR_CALENDARIO", `${date} · ${reason}`); byId("holidayForm").reset(); await loadHolidays(); show("Día no laborable guardado.");
    } catch (error) { console.error(error); show("No se pudo guardar la fecha. Revisa el calendario y tus permisos.", "error"); }
  });
  byId("holidayRows").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-holiday]"); if (!button) return;
    const holiday = holidays.find((item) => String(item.id_dia) === button.dataset.holiday); if (!holiday) return;
    const { error } = await app.client.from("dias_no_laborables").update({ activo: !holiday.activo }).eq("id_dia", holiday.id_dia);
    if (error) { show("No se pudo cambiar el estado de la fecha.", "error"); return; }
    await app.logAction(holiday.activo ? "DESACTIVAR_DIA_NO_LABORABLE" : "REACTIVAR_DIA_NO_LABORABLE", `${holiday.fecha} · ${holiday.motivo}`); await loadHolidays(); show("Calendario actualizado.");
  });
  window.moduleReady.then(async (context) => { if (!context) return; app = context; try { await Promise.all([loadSchool(), loadSchedule(), loadHolidays()]); } catch (error) { console.error(error); show("No se pudo cargar toda la configuración.", "error"); } });
})();
