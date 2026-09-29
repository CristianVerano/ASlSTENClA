(() => {
  const client = window.adminAuth?.client;
  const form = document.querySelector("#acceptForm"); const message = document.querySelector("#acceptMessage"); const button = document.querySelector("#acceptButton");
  const show = (text, type = "error") => { message.textContent = text; message.className = `message ${type}`; message.hidden = false; };
  if (!client) { show("No se pudo conectar con Supabase. Recarga la página o contacta al director."); return; }
  client.auth.getSession().then(({ data, error }) => {
    if (error || !data.session) show("El enlace no es válido o venció. Para una invitación, pide al director que te ayude; para recuperar tu contraseña, vuelve a solicitar el enlace desde el inicio de sesión.");
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); const password = document.querySelector("#newPassword").value; const confirmPassword = document.querySelector("#confirmPassword").value;
    if (password.length < 10) return show("La contraseña debe tener al menos 10 caracteres.");
    if (password !== confirmPassword) return show("Las contraseñas no coinciden.");
    button.disabled = true;
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession(); if (sessionError || !sessionData.session) throw new Error("El enlace venció. Solicita uno nuevo desde el inicio de sesión o pide otra invitación al director.");
      const { error } = await client.auth.updateUser({ password }); if (error) throw error;
      show("Contraseña guardada. Ya puedes iniciar sesión.", "success"); form.reset(); setTimeout(() => window.location.replace("login.html"), 1200);
    } catch (error) { console.error(error); show(error.message || "No se pudo guardar la contraseña."); }
    finally { button.disabled = false; }
  });
})();
