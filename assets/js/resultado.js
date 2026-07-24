/**
 * ICAC - Lógica de la página /resultado/
 *
 * SEGURIDAD (importante): esta página YA NO confía en calificación, aprobado,
 * elegibilidad ni ningún otro dato de resultado recibido como parámetro de la
 * URL. Antes lo hacía (approved=..., grade=..., cert=..., etc.), y eso permitía
 * que cualquiera editara esos parámetros a simple vista en la barra de
 * direcciones y viera un resultado falso (por ejemplo "Aprobado" cuando en
 * realidad no lo estaba).
 *
 * Ahora la página recibe ÚNICAMENTE ?token=TOKEN_RESULTADO (el Token de
 * resultado, público por diseño, igual que el Token individual usado en
 * /registro/ y /evaluacion/) y consulta el resultado real contra el backend
 * seguro GET /icac/public/evaluation/result?token=... a través de
 * window.ICAC_API.getResult() (ver assets/js/api.js). Esa API nunca expone
 * Record IDs de Airtable ni el contenido de las respuestas correctas: solo
 * conteos agregados y los campos de calificación ya validados en el servidor.
 *
 * Reglas de seguridad de este archivo:
 *   - Nunca usa innerHTML con datos de la API (siempre textContent).
 *   - Nunca usa localStorage/sessionStorage.
 *   - Cualquier parámetro de la URL que no sea "token" se ignora por completo.
 */
(function () {
  "use strict";

  var els = {
    loading: document.getElementById("icac-state-loading"),
    noToken: document.getElementById("icac-state-no-token"),
    error: document.getElementById("icac-state-error"),
    result: document.getElementById("icac-state-result"),

    errorTitle: document.getElementById("icac-error-title"),
    errorMessage: document.getElementById("icac-error-message"),
    retryButton: document.getElementById("icac-retry-button"),

    badge: document.getElementById("icac-result-badge"),
    title: document.getElementById("icac-result-title"),
    score: document.getElementById("icac-result-score"),
    message: document.getElementById("icac-result-message"),
    facts: document.getElementById("icac-result-facts"),
    certCard: document.getElementById("icac-cert-card"),
    certMessage: document.getElementById("icac-cert-message")
  };

  var ALL_STATES = [els.loading, els.noToken, els.error, els.result];

  var resultToken = null;

  function showOnly(section) {
    for (var i = 0; i < ALL_STATES.length; i++) {
      var el = ALL_STATES[i];
      if (!el) continue;
      el.hidden = el !== section;
    }
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value === undefined || value === null || value === "" ? "" : String(value);
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function addFact(label, value) {
    if (value === undefined || value === null || value === "") return;
    var li = document.createElement("li");
    li.className = "icac-result-facts__item";
    var labelEl = document.createElement("span");
    labelEl.className = "icac-result-facts__label";
    labelEl.textContent = label;
    var valueEl = document.createElement("span");
    valueEl.className = "icac-result-facts__value";
    valueEl.textContent = value;
    li.appendChild(labelEl);
    li.appendChild(valueEl);
    els.facts.appendChild(li);
  }

  /* ----------------------------------------------------------------------
   * Mapeo de códigos de error del backend a mensajes amigables
   * ------------------------------------------------------------------- */
  var ERROR_MESSAGES = {
    RESULT_TOKEN_REQUIRED: { title: "Falta el código de tu resultado", message: "Usa el enlace que recibiste al terminar tu evaluación." },
    INVALID_RESULT_TOKEN: { title: "El enlace no es válido", message: "Verifica que copiaste la liga completa o pide a tu capacitador que te la comparta de nuevo." },
    RESULT_NOT_FOUND: { title: "No encontramos tu resultado", message: "Verifica el enlace o pide a tu capacitador el detalle de tu evaluación." },
    NETWORK_ERROR: { title: "No pudimos cargar tu resultado", message: "Verifica tu conexión a internet e intenta de nuevo." },
    INVALID_RESPONSE: { title: "No pudimos cargar tu resultado", message: "Ocurrió un problema al leer la respuesta del servidor. Intenta de nuevo." }
  };

  function showError(code, fallbackMessage) {
    var info = ERROR_MESSAGES[code] || { title: "No pudimos cargar tu resultado", message: fallbackMessage || "Ocurrió un problema. Intenta de nuevo más tarde." };
    setText(els.errorTitle, info.title);
    setText(els.errorMessage, fallbackMessage || info.message);
    showOnly(els.error);
  }

  function render(data) {
    var approved = !!data.approved;
    var showGrade = !!data.showGrade;

    els.badge.hidden = false;
    els.badge.classList.remove("icac-result-badge--approved", "icac-result-badge--rejected");
    els.badge.classList.add(approved ? "icac-result-badge--approved" : "icac-result-badge--rejected");
    setText(els.badge, approved ? "Aprobado" : "No aprobado");
    setText(els.title, approved ? "¡Felicidades, aprobaste!" : "No alcanzaste la calificación mínima");

    if (showGrade && typeof data.grade === "number") {
      els.score.hidden = false;
      setText(els.score, data.grade + "%");
    } else {
      els.score.hidden = true;
    }

    setText(
      els.message,
      approved
        ? "Ya completaste esta evaluación correctamente. Tu capacitador tiene el registro de tu resultado."
        : "Puedes revisar el material del curso. Si te quedan intentos disponibles, tu capacitador te indicará cómo volver a presentarla."
    );

    clearNode(els.facts);
    addFact("Curso", data.course);
    addFact("Evaluación", data.evaluationName);
    if (typeof data.attemptNumber === "number") {
      addFact("Número de intento", data.attemptNumber);
    }
    addFact("Preguntas correctas", data.correctAnswers);
    addFact("Preguntas incorrectas", data.incorrectAnswers);
    addFact("Preguntas sin responder", data.unanswered);
    addFact("Total de preguntas", data.totalQuestions);
    if (showGrade && typeof data.score === "number" && typeof data.maxScore === "number") {
      addFact("Puntaje", data.score + " / " + data.maxScore);
    }
    if (typeof data.minPassingGrade === "number") {
      addFact("Calificación mínima requerida", data.minPassingGrade + "%");
    }

    els.certCard.hidden = !(approved && data.eligibleForCertificate);

    showOnly(els.result);
  }

  function load() {
    showOnly(els.loading);
    window.ICAC_API.getResult(resultToken).then(function (response) {
      if (response.success && response.data) {
        render(response.data);
        return;
      }
      showError(response.code, response.message);
    });
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    resultToken = (params.get("token") || "").trim();

    if (!resultToken) {
      showOnly(els.noToken);
      return;
    }

    if (els.retryButton) {
      els.retryButton.addEventListener("click", load);
    }

    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
