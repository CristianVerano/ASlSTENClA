(() => {
  const byId = (id) => document.getElementById(id);
  let app; let events = [];
  function alert(text) { const node = byId("activityAlert"); node.textContent = text; node.className = "module-alert show error"; }
  function filtered() {
    const term = byId("activitySearch").value.trim().toLocaleLowerCase("es");
    return events.filter((item) => `${item.accion} ${item.descripcion || ""} ${item.persona || ""}`.toLocaleLowerCase("es").includes(term));
  }
  function render() {
    const rows = byId("activityRows"); rows.replaceChildren(); const list = filtered();
    if (!list.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 4; cell.className = "empty-cell"; cell.textContent = "No hay actividad que coincida con los filtros."; row.append(cell); rows.append(row); return; }
    list.forEach((item) => { const row = document.createElement("tr"); const date = document.createElement("td"); date.textContent = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" }).format(new Date(item.fecha_hora)); const person = document.createElement("td"); person.textContent = item.persona || "Cuenta eliminada"; const action = document.createElement("td"); action.textContent = item.accion.replaceAll("_", " ").toLocaleLowerCase("es"); const detail = document.createElement("td"); detail.textContent = item.descripcion || "—"; row.append(date, person, action, detail); rows.append(row); });
  }
  async function load() {
    const query = app.client.from("registro_actividades").select("id_registro,id_usuario,accion,descripcion,fecha_hora").order("fecha_hora", { ascending: false }).limit(5000);
    if (byId("activityFrom").value) query.gte("fecha_hora", `${byId("activityFrom").value}T00:00:00-05:00`);
    if (byId("activityTo").value) query.lte("fecha_hora", `${byId("activityTo").value}T23:59:59-05:00`);
    const { data, error } = await query; if (error) throw error;
    events = data || []; const ids = [...new Set(events.map((item) => item.id_usuario).filter(Boolean))];
    if (ids.length) {
      const { data: profiles, error: profileError } = await app.client.from("perfiles").select("id_usuario,nombres,apellidos").in("id_usuario", ids);
      if (profileError) throw profileError;
      const names = new Map((profiles || []).map((profile) => [profile.id_usuario, `${profile.nombres} ${profile.apellidos}`]));
      events = events.map((item) => ({ ...item, persona: names.get(item.id_usuario) || "Cuenta eliminada" }));
    }
    render();
  }
  function exportCsv() {
    const data = [["Fecha y hora", "Usuario", "Acción", "Detalle"], ...filtered().map((item) => [item.fecha_hora, item.persona || "Cuenta eliminada", item.accion, item.descripcion || ""])];
    const csv = "\uFEFF" + data.map((line) => line.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = "registro-actividad.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  byId("refreshActivity").addEventListener("click", () => load().catch((error) => { console.error(error); alert("No se pudo actualizar la bitácora."); }));
  byId("activitySearch").addEventListener("input", render); byId("exportActivity").addEventListener("click", exportCsv);
  window.moduleReady.then(async (context) => { if (!context) return; app = context; try { await load(); } catch (error) { console.error(error); alert("No se pudo cargar la bitácora. Esta sección requiere el rol DIRECTOR."); } });
})();
