(() => {
  const { client, getAuthorizedProfile } = window.adminAuth || {};
  const form = document.querySelector("#centralLoginForm");
  const message = document.querySelector("#centralLoginMessage");
  const button = document.querySelector("#centralLoginButton");
  const password = document.querySelector("#centralPassword");
  const dashboardPath = "dashboard.html";
  const changePasswordPath = "../admin/cambiar-contrasena.html";

  function show(text, kind = "error") { message.textContent = text; message.className = `message ${kind}`; message.hidden = false; }
  function continueTo(profile) {
    if (profile.requiereCambioContrasena) { sessionStorage.setItem("centralLogin", "1"); window.location.replace(changePasswordPath); }
    else { sessionStorage.removeItem("centralLogin"); window.location.replace(dashboardPath); }
  }

  async function verifyExistingSession() {
    if (!client) return show("No se pudo conectar con la central. Revisa la configuración de Supabase.");
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return;
    try {
      const profile = await getAuthorizedProfile(session.user.id);
      if (profile?.role === "SUPERADMIN") continueTo(profile);
      else { await client.auth.signOut(); show("Esta cuenta no tiene acceso a la central. Usa el acceso administrativo de tu colegio."); }
    } catch { show("No se pudo verificar el acceso a la plataforma. Vuelve a intentarlo."); }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) return show("No se pudo conectar con la central. Revisa la configuración de Supabase.");
    message.hidden = true; button.disabled = true; button.querySelector("span:first-child").textContent = "Verificando…";
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: document.querySelector("#centralEmail").value.trim(), password: password.value });
      if (error) throw new Error("No pudimos iniciar sesión. Verifica el correo y la contraseña.");
      const profile = await getAuthorizedProfile(data.user.id);
      if (profile?.role !== "SUPERADMIN") {
        await client.auth.signOut();
        return show("Esta cuenta no tiene rol SUPERADMIN. Para administrar un colegio, usa el acceso administrativo institucional.");
      }
      continueTo(profile);
    } catch (error) {
      console.error("No se pudo verificar el acceso central:", error);
      show(error.message || "No se pudo verificar el acceso. Comprueba la conexión e inténtalo de nuevo.");
    } finally { button.disabled = false; button.querySelector("span:first-child").textContent = "Entrar a la central"; }
  });

  document.querySelector("#centralTogglePassword").addEventListener("click", (event) => {
    const visible = password.type === "password"; password.type = visible ? "text" : "password";
    event.currentTarget.textContent = visible ? "Ocultar" : "Mostrar"; event.currentTarget.setAttribute("aria-pressed", String(visible));
  });
  document.querySelector("#centralForgotPassword").addEventListener("click", async () => {
    if (!client) return show("No se pudo conectar con la central. Revisa la configuración de Supabase.");
    const email = document.querySelector("#centralEmail").value.trim();
    if (!email) return show("Escribe tu correo y luego selecciona ‘Olvidé mi contraseña’.");
    const resetButton = document.querySelector("#centralForgotPassword"); resetButton.disabled = true;
    try {
      const redirectTo = new URL("/pages/admin/accept-invite.html", window.location.origin).href;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      show("Si ese correo tiene acceso, recibirás un enlace para cambiar la contraseña.", "success");
    } catch (error) { console.error(error); show("No se pudo enviar el enlace. Comprueba el correo e inténtalo nuevamente."); }
    finally { resetButton.disabled = false; }
  });

  verifyExistingSession();
  if (new URLSearchParams(window.location.search).get("actualizada") === "1") show("Contraseña actualizada. Inicia sesión con tu nueva contraseña.", "success");
})();
