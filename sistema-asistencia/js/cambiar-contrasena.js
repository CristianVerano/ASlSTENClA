(() => {
  const client = window.adminAuth?.client;
  const form = document.querySelector("#changePasswordForm");
  const message = document.querySelector("#changePasswordMessage");
  const button = document.querySelector("#changePasswordButton");
  const show = (text, kind = "error") => { message.textContent = text; message.className = `message ${kind}`; message.hidden = false; };
  if (!client) { show("No se pudo conectar con el servicio de acceso. Recarga la página."); return; }

  async function verifyRequiredChange() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData.session) { window.location.replace("login.html"); return false; }
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) { window.location.replace("login.html"); return false; }
    if (userData.user.app_metadata?.requiere_cambio_contrasena !== true) {
      window.location.replace("dashboard.html");
      return false;
    }
    return true;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#newPassword").value;
    const confirmation = document.querySelector("#confirmPassword").value;
    if (password.length < 12) return show("Usa al menos 12 caracteres para tu nueva contraseña.");
    if (password !== confirmation) return show("Las contraseñas no coinciden.");
    button.disabled = true;
    try {
      if (!(await verifyRequiredChange())) return;
      const { error: passwordError } = await client.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      const { data, error } = await client.functions.invoke("invitar-usuario-admin", { body: { action: "confirmar-cambio-contrasena" } });
      if (error || data?.error) throw new Error(data?.error || error.message || "No se pudo confirmar el cambio.");
      show("Contraseña actualizada. Volverás al inicio para ingresar con tu nueva clave.", "success");
      form.reset();
      await client.auth.signOut();
      const centralLogin = sessionStorage.getItem("centralLogin") === "1";
      const schoolSlug = new URLSearchParams(window.location.search).get("colegio") || sessionStorage.getItem("adminSchoolSlug");
      const nextLogin = centralLogin ? "../superadmin/login.html?actualizada=1" : `login.html?colegio=${encodeURIComponent(schoolSlug || "")}&actualizada=1`;
      sessionStorage.removeItem("centralLogin");
      setTimeout(() => window.location.replace(nextLogin), 1200);
    } catch (error) {
      console.error("No se pudo completar el cambio de contraseña:", error);
      show(error.message || "No se pudo cambiar la contraseña. Inténtalo nuevamente.");
    } finally { button.disabled = false; }
  });

  verifyRequiredChange();
})();
