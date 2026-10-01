(() => {
  const { client, getAuthorizedProfile, getSelectedSchool } = window.adminAuth || {};
  const form = document.querySelector("#loginForm");
  const message = document.querySelector("#loginMessage");
  const button = document.querySelector("#loginButton");
  const password = document.querySelector("#password");
  let selectedSchool = null;

  const schoolReady = getSelectedSchool().then((school) => {
    selectedSchool = school;
    if (!school) {
      message.textContent = "Primero selecciona el colegio al que deseas ingresar.";
      message.className = "message error";
      message.hidden = false;
      window.location.replace("../../index.html");
    }
    return school;
  }).catch((error) => {
    console.error("No se pudo validar el colegio seleccionado:", error);
    showError("No se pudo validar el colegio. Regresa a la lista e inténtalo nuevamente.");
    return null;
  });

  async function validateSchoolProfile(profile) {
    if (!profile || profile.role === "SUPERADMIN" || Number(profile.id_colegio) !== Number(selectedSchool?.id_colegio)) {
      await client.auth.signOut();
      showError(profile?.role === "SUPERADMIN"
        ? "Esta cuenta es de la Central Administrativa. Inicia sesión desde ese acceso."
        : `Esta cuenta no pertenece a ${selectedSchool?.nombre || "este colegio"}. Selecciona la institución correcta.`);
      return false;
    }
    sessionStorage.setItem("adminSchoolId", String(selectedSchool.id_colegio));
    sessionStorage.setItem("adminSchoolSlug", selectedSchool.slug);
    return true;
  }

  function showError(text) {
    message.textContent = text;
    message.className = "message error";
    message.hidden = false;
  }

  function goToPanel(profile) {
    if (profile.requiereCambioContrasena) window.location.replace(`cambiar-contrasena.html?colegio=${encodeURIComponent(selectedSchool.slug)}`);
    else if (profile.role === "SUPERADMIN") window.location.replace("../superadmin/login.html");
    else window.location.replace("dashboard.html");
  }

  async function checkExistingSession() {
    if (!client) return showError("No se pudo iniciar la conexión. Revisa la configuración de Supabase.");
    if (!await schoolReady) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    try {
      const profile = await getAuthorizedProfile(session.user.id);
      if (profile && await validateSchoolProfile(profile)) goToPanel(profile);
      else await client.auth.signOut();
    } catch {
      showError("No se pudo verificar tu perfil. Intenta iniciar sesión nuevamente.");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!await schoolReady) return;
    if (!client) return showError("No se pudo iniciar la conexión. Revisa la configuración de Supabase.");
    message.hidden = true;
    button.disabled = true;
    button.querySelector("span:first-child").textContent = "Verificando…";
    const email = document.querySelector("#email").value.trim();
    const passwordValue = password.value;
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password: passwordValue });
      if (error) {
        showError("No pudimos iniciar sesión. Verifica tu correo y contraseña.");
        return;
      }
      const profile = await getAuthorizedProfile(data.user.id);
      if (!await validateSchoolProfile(profile)) {
        if (!profile) showError("Tu cuenta no tiene un perfil activo con un rol autorizado. Contacta al administrador del colegio.");
        return;
      }
      goToPanel(profile);
    } catch (error) {
      console.error("Error al verificar el acceso administrativo:", error);
      showError("No se pudo verificar tu acceso. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      button.disabled = false;
      button.querySelector("span:first-child").textContent = "Iniciar sesión";
    }
  });

  document.querySelector("#togglePassword").addEventListener("click", (event) => {
    const visible = password.type === "password";
    password.type = visible ? "text" : "password";
    event.currentTarget.textContent = visible ? "Ocultar" : "Mostrar";
    event.currentTarget.setAttribute("aria-pressed", String(visible));
  });

  document.querySelector("#forgotPassword").addEventListener("click", async () => {
    if (!client) return showError("No se pudo iniciar la conexión. Revisa la configuración de Supabase.");
    const email = document.querySelector("#email").value.trim();
    if (!email) return showError("Escribe tu correo y luego selecciona ‘Olvidé mi contraseña’.");
    const resetButton = document.querySelector("#forgotPassword"); resetButton.disabled = true;
    try {
      const redirectTo = new URL("/pages/admin/accept-invite.html", window.location.origin).href;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      message.textContent = "Si ese correo tiene acceso, recibirás un enlace para cambiar la contraseña."; message.className = "message success"; message.hidden = false;
    } catch (error) { console.error(error); showError("No se pudo enviar el enlace. Comprueba el correo e inténtalo nuevamente."); }
    finally { resetButton.disabled = false; }
  });

  checkExistingSession();
  if (new URLSearchParams(window.location.search).get("actualizada") === "1") {
    message.textContent = "Contraseña actualizada. Inicia sesión con tu nueva contraseña.";
    message.className = "message success";
    message.hidden = false;
  }
})();
