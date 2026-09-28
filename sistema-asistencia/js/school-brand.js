(() => {
  async function applySchoolBrand() {
    if (!window.supabase?.createClient || !window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY) return;
    const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await client.rpc("obtener_identidad_publica_colegio");
    if (error || !data) return;
    const name = data.nombre_colegio || "Mi Colegio";
    document.querySelectorAll("#nombreColegio,#nombreColegioFooter,#footerSchool").forEach((element) => { element.textContent = name; });
    const motto = document.querySelector("#schoolMotto");
    if (motto && data.lema) motto.textContent = data.lema;
    document.title = document.title.replace("Mi Colegio", name);
    const root = document.documentElement;
    if (/^#[0-9a-f]{6}$/i.test(data.color_principal || "")) root.style.setProperty("--school-primary", data.color_principal);
    if (/^#[0-9a-f]{6}$/i.test(data.color_secundario || "")) root.style.setProperty("--school-secondary", data.color_secundario);
    if (/^#[0-9a-f]{6}$/i.test(data.color_fondo || "")) root.style.setProperty("--school-background", data.color_fondo);
    root.dataset.colorMode = data.modo || "CLARO";
    const mark = document.querySelector("#schoolLogoMark");
    if (mark && data.logo_url) {
      const logo = document.createElement("img"); logo.src = data.logo_url; logo.alt = ""; logo.className = "school-logo-image";
      logo.addEventListener("error", () => { logo.remove(); mark.textContent = name.slice(0, 1).toLocaleUpperCase("es"); }, { once: true });
      mark.replaceChildren(logo);
    } else if (mark) mark.textContent = name.slice(0, 1).toLocaleUpperCase("es");
  }
  applySchoolBrand().catch(() => {});
})();
