(() => {
  const client = window.supabase?.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );
  const form = document.querySelector("#formulario");
  const codeInput = document.querySelector("#codigo");
  const submitButton = document.querySelector("#btnIngresar");
  const message = document.querySelector("#mensaje");
  const studentCard = document.querySelector("#tarjetaEstudiante");
  let clearTimer;
  const schoolSlug = new URLSearchParams(window.location.search).get("colegio") || "";
  if (!schoolSlug) return;

  const clockOptions = { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
  const dateOptions = { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long", year: "numeric" };

  function updateClock() {
    const now = new Date();
    document.querySelector("#hora").textContent = new Intl.DateTimeFormat("es-PE", clockOptions).format(now);
    document.querySelector("#fecha").textContent = new Intl.DateTimeFormat("es-PE", dateOptions).format(now);
    document.querySelector("#anio").textContent = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", year: "numeric" }).format(now);
  }

  function showMessage(text, type = "info") {
    message.textContent = text;
    message.className = `message ${type}`;
    message.hidden = false;
  }

  function clearResult() {
    studentCard.hidden = true;
    message.hidden = true;
    codeInput.value = "";
    codeInput.focus();
  }

  function initials(student) {
    return `${student.nombres.trim().charAt(0)}${student.apellidos.trim().charAt(0)}`.toLocaleUpperCase("es");
  }

  function displayStudent(student, attendance) {
    const fullName = `${student.nombres} ${student.apellidos}`.trim();
    const level = student.nivel ? ` · ${student.nivel.toLocaleLowerCase("es")}` : "";
    document.querySelector("#nombreEstudiante").textContent = fullName;
    document.querySelector("#aulaEstudiante").textContent = `${student.grado}${level} · Sección ${student.seccion}`;
    document.querySelector("#iniciales").textContent = initials(student);
    document.querySelector("#estadoTexto").textContent = attendance.estado;
    document.querySelector("#horaRegistro").textContent = attendance.hora_ingreso.slice(0, 5);
    const pill = document.querySelector("#estadoPill");
    pill.className = "status-pill";
    if (attendance.estado === "TARDANZA") pill.classList.add("late");
    if (attendance.estado === "FALTA") pill.classList.add("absent");
    studentCard.hidden = false;

    if (attendance.resultado === "DUPLICADO") {
      showMessage(`La asistencia de hoy ya estaba registrada. Se conserva el primer registro de las ${attendance.hora_ingreso.slice(0, 5)}.`, "info");
    } else {
      const descriptions = { PRESENTE: "¡Asistencia registrada. Que tengas un excelente día!", TARDANZA: "Tu ingreso quedó registrado como tardanza.", FALTA: "El horario de registro terminó; el sistema guardó el estado configurado." };
      showMessage(descriptions[attendance.estado] || "Asistencia registrada.", attendance.estado === "PRESENTE" ? "success" : "info");
    }
    clearTimeout(clearTimer);
    clearTimer = setTimeout(clearResult, 9000);
  }

  async function register(code) {
    if (!window.selectedSchool || window.selectedSchool.slug !== schoolSlug) {
      showMessage("Selecciona un colegio válido antes de registrar asistencia.", "error");
      return;
    }
    if (!client) {
      showMessage("No se pudo iniciar la conexión. Revisa js/supabase-config.js y vuelve a cargar la página.", "error");
      return;
    }
    const { data: students, error: searchError } = await client.rpc("buscar_estudiante_asistencia", { p_codigo: code, p_colegio_slug: schoolSlug });
    if (searchError) throw searchError;
    const student = students?.[0];
    if (!student) {
      studentCard.hidden = true;
      showMessage("No encontramos un estudiante activo con ese código. Verifica e inténtalo nuevamente.", "error");
      return;
    }

    const { data: attendance, error: attendanceError } = await client.rpc("registrar_asistencia_publica", { p_codigo: code, p_colegio_slug: schoolSlug });
    if (attendanceError) throw attendanceError;
    if (attendance.resultado === "NO_LABORABLE") {
      studentCard.hidden = true;
      showMessage(attendance.motivo ? `Hoy no hay clases: ${attendance.motivo}.` : "Hoy no hay clases. No se registró asistencia.", "info");
      return;
    }
    displayStudent(student, attendance);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.elements.website?.value) return;
    const code = codeInput.value.trim();
    if (!code) {
      codeInput.focus();
      return;
    }
    clearTimeout(clearTimer);
    message.hidden = true;
    studentCard.hidden = true;
    submitButton.disabled = true;
    submitButton.querySelector("span:first-child").textContent = "Registrando…";
    try {
      await register(code);
    } catch (error) {
      console.error("Error de asistencia:", error);
      showMessage("No se pudo completar el registro. Comprueba la conexión a internet y vuelve a intentarlo.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span:first-child").textContent = "Registrar ingreso";
      codeInput.focus();
    }
  });

  updateClock();
  setInterval(updateClock, 1000);
  if (!client) showMessage("Falta configurar la conexión con Supabase. Revisa js/supabase-config.js.", "error");
})();
