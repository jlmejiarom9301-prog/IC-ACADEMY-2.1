/**
 * ICAC - Lógica de la página /evaluacion/
 *
 * Reglas de seguridad de este archivo:
 *   - Nunca usa innerHTML con contenido proveniente de la API (siempre
 *     textContent / creación de nodos DOM).
 *   - Nunca guarda el token, las respuestas ni ningún dato personal en
 *     localStorage/sessionStorage: todo vive en variables de memoria y se
 *     pierde si el participante recarga la página (deberá volver a entrar
 *     con el mismo enlace, que es idempotente gracias al backend).
 *   - Nunca imprime el payload completo de la evaluación o de las
 *     respuestas a la consola.
 *   - La validación de este archivo es solo para UX; la API vuelve a
 *     validar y calificar todo del lado del servidor y es la única fuente
 *     de verdad.
 */
(function () {
  "use strict";

  var els = {
    loading: document.getElementById("icac-state-loading"),
    loadingMessage: document.getElementById("icac-loading-message"),
    noToken: document.getElementById("icac-state-no-token"),
    blocked: document.getElementById("icac-state-blocked"),
    blockedIcon: document.getElementById("icac-blocked-icon"),
    blockedTitle: document.getElementById("icac-blocked-title"),
    blockedMessage: document.getElementById("icac-blocked-message"),
    retryButton: document.getElementById("icac-retry-button"),
    approved: document.getElementById("icac-state-approved"),
    approvedMessage: document.getElementById("icac-approved-message"),
    approvedResultButton: document.getElementById("icac-approved-result-button"),

    start: document.getElementById("icac-state-start"),
    startBadge: document.getElementById("icac-start-badge"),
    evalName: document.getElementById("icac-eval-name"),
    startFacts: document.getElementById("icac-start-facts"),
    startInstructions: document.getElementById("icac-start-instructions"),
    startError: document.getElementById("icac-start-error"),
    startButton: document.getElementById("icac-start-button"),

    quiz: document.getElementById("icac-state-quiz"),
    quizPosition: document.getElementById("icac-quiz-position"),
    quizSection: document.getElementById("icac-quiz-section"),
    progressFill: document.getElementById("icac-quiz-progress-fill"),
    questionSection: document.getElementById("icac-question-section"),
    questionText: document.getElementById("icac-question-text"),
    questionMeta: document.getElementById("icac-question-meta"),
    questionInput: document.getElementById("icac-question-input"),
    quizError: document.getElementById("icac-quiz-error"),
    quizPrev: document.getElementById("icac-quiz-prev"),
    quizNext: document.getElementById("icac-quiz-next"),
    quizSubmit: document.getElementById("icac-quiz-submit"),
    questionDots: document.getElementById("icac-question-dots"),

    submitting: document.getElementById("icac-state-submitting")
  };

  var ALL_STATES = [
    els.loading,
    els.noToken,
    els.blocked,
    els.approved,
    els.start,
    els.quiz,
    els.submitting
  ];

  var individualToken = null;
  var resultToken = null;
  var questions = [];
  var answers = {}; // questionId -> answer payload (en memoria, nunca persistido)
  var currentIndex = 0;
  var isBusy = false;

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

  function getTokenFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get("token");
    return token ? token.trim() : "";
  }

  function addFact(container, label, value) {
    if (value === undefined || value === null || value === "") return;
    var li = document.createElement("li");
    li.className = "icac-session-facts__item";
    var labelEl = document.createElement("span");
    labelEl.className = "icac-session-facts__label";
    labelEl.textContent = label;
    var valueEl = document.createElement("span");
    valueEl.className = "icac-session-facts__value";
    valueEl.textContent = value;
    li.appendChild(labelEl);
    li.appendChild(valueEl);
    container.appendChild(li);
  }

  /* ----------------------------------------------------------------------
   * Mapeo de códigos de "no disponible" a mensajes amigables
   * ------------------------------------------------------------------- */
  var BLOCKED_MESSAGES = {
    TOKEN_REQUIRED: { title: "Falta el código de tu evaluación", message: "Usa el enlace que te compartimos al confirmar tu registro." },
    INVALID_TOKEN: { title: "El enlace no es válido", message: "Verifica que copiaste la liga completa o pide a tu capacitador que te la comparta de nuevo." },
    REGISTRO_NOT_FOUND: { title: "No encontramos tu registro", message: "Verifica el enlace o vuelve a escanear el código QR de tu sesión." },
    SESSION_CANCELLED: { title: "Esta sesión fue cancelada", message: "Contacta a tu capacitador para más información." },
    EVALUATION_NOT_ASSIGNED: { title: "Todavía no hay evaluación", message: "Esta sesión todavía no tiene una evaluación asignada. Intenta más tarde." },
    EVALUATION_INACTIVE: { title: "La evaluación no está activa", message: "Contacta a tu capacitador para más información." },
    ATTENDANCE_REQUIRED: { title: "Necesitas confirmar tu asistencia", message: "Pide a tu capacitador que confirme tu asistencia antes de presentar la evaluación." },
    EVALUATION_NOT_OPEN: { title: "La evaluación aún no está abierta", message: "Tu capacitador todavía no habilita esta evaluación. Intenta más tarde." },
    ATTEMPTS_EXHAUSTED: { title: "Ya no tienes intentos disponibles", message: "Usaste todos los intentos permitidos para esta evaluación. Contacta a tu capacitador si crees que esto es un error." }
  };

  function showBlocked(code, fallbackMessage) {
    var info = BLOCKED_MESSAGES[code] || { title: "La evaluación no está disponible", message: fallbackMessage || "Ocurrió un problema. Intenta de nuevo más tarde." };
    setText(els.blockedTitle, info.title);
    setText(els.blockedMessage, fallbackMessage || info.message);
    els.retryButton.hidden = code !== "INVALID_TOKEN" && code !== "REGISTRO_NOT_FOUND" && code !== "EVALUATION_NOT_OPEN" && code !== "ATTENDANCE_REQUIRED";
    showOnly(els.blocked);
  }

  function showApproved(data, message) {
    setText(els.approvedMessage, message || "No necesitas presentarla de nuevo.");
    if (data && data.resultToken) {
      els.approvedResultButton.hidden = false;
      els.approvedResultButton.onclick = function () {
        window.location.href = "../resultado/?token=" + encodeURIComponent(data.resultToken);
      };
    } else {
      els.approvedResultButton.hidden = true;
    }
    showOnly(els.approved);
  }

  function renderStart(data) {
    setText(els.evalName, data.evaluationName || "Evaluación");
    els.startFacts.innerHTML = "";
    addFact(els.startFacts, "Curso", data.evaluationCode);
    addFact(els.startFacts, "Preguntas", data.totalQuestions);
    if (typeof data.minPassingGrade === "number") {
      addFact(els.startFacts, "Calificación mínima", data.minPassingGrade + "%");
    }
    if (typeof data.maxAttempts === "number" && typeof data.attemptsUsed === "number") {
      addFact(els.startFacts, "Intentos", data.attemptsUsed + " de " + data.maxAttempts);
    }
    if (data.timeLimitMinutes) {
      addFact(els.startFacts, "Tiempo sugerido", data.timeLimitMinutes + " min");
    }
    setText(
      els.startInstructions,
      data.attemptInProgress
        ? "Tienes un intento en progreso. Al continuar retomarás tus respuestas donde las dejaste."
        : "Responde con calma. Puedes moverte entre preguntas antes de enviar tu evaluación."
    );
    setText(els.startButton, data.attemptInProgress ? "Continuar evaluación" : "Comenzar evaluación");
    showOnly(els.start);
  }

  /* ----------------------------------------------------------------------
   * Consulta inicial (GET /evaluation)
   * ------------------------------------------------------------------- */
  function loadEvaluation() {
    showOnly(els.loading);
    setText(els.loadingMessage, "Buscando los datos de tu evaluación…");
    window.ICAC_API.getEvaluation(individualToken).then(function (response) {
      if (response.success) {
        var data = response.data || {};
        if (data.alreadyApproved) {
          showApproved(data, response.message);
        } else if (data.canStart || data.attemptInProgress) {
          renderStart(data);
        } else {
          showBlocked(response.code, response.message);
        }
        return;
      }
      showBlocked(response.code, response.message);
    });
  }

  /* ----------------------------------------------------------------------
   * Inicio / reanudación de intento (POST /evaluation/start)
   * ------------------------------------------------------------------- */
  function onStartClick() {
    if (isBusy) return;
    isBusy = true;
    setText(els.startError, "");
    els.startError.classList.remove("is-visible");
    els.startButton.disabled = true;
    setText(els.startButton, "Cargando…");

    window.ICAC_API.startAttempt(individualToken)
      .then(function (response) {
        if (!response.success) {
          setText(els.startError, response.message || "No pudimos iniciar tu evaluación. Intenta de nuevo.");
          els.startError.classList.add("is-visible");
          return;
        }
        var data = response.data || {};
        resultToken = data.resultToken || null;
        questions = Array.isArray(data.questions) ? data.questions : [];
        answers = {};
        for (var i = 0; i < questions.length; i++) {
          if (questions[i].readOnly && questions[i].prefillValue !== undefined) {
            answers[questions[i].id] = { questionId: questions[i].id, textAnswer: questions[i].prefillValue };
          }
        }
        currentIndex = 0;
        if (!questions.length) {
          setText(els.startError, "Esta evaluación todavía no tiene preguntas configuradas.");
          els.startError.classList.add("is-visible");
          return;
        }
        renderQuestion();
        showOnly(els.quiz);
      })
      .catch(function () {
        setText(els.startError, "No pudimos iniciar tu evaluación. Intenta de nuevo en unos minutos.");
        els.startError.classList.add("is-visible");
      })
      .then(function () {
        isBusy = false;
        els.startButton.disabled = false;
        setText(els.startButton, "Comenzar evaluación");
      });
  }

  /* ----------------------------------------------------------------------
   * Render del cuestionario (una pregunta a la vez)
   * ------------------------------------------------------------------- */
  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function currentAnswer(qid) {
    return answers[qid] || null;
  }

  function markAnswered(dotEl, answered) {
    dotEl.classList.toggle("is-answered", !!answered);
  }

  function isQuestionAnswered(q) {
    var a = answers[q.id];
    if (!a) return false;
    if (q.type === "Opción múltiple") return Array.isArray(a.selectedOptionIds) && a.selectedOptionIds.length > 0;
    if (q.type === "Escala" || q.type === "Satisfacción") return a.scaleValue !== undefined && a.scaleValue !== null && a.scaleValue !== "";
    if (q.type === "Texto corto" || q.type === "Texto largo") return !!(a.textAnswer && a.textAnswer.toString().trim());
    return !!a.selectedOptionId;
  }

  function renderOptionsSingle(q, container) {
    var list = document.createElement("ul");
    list.className = "icac-options";
    var current = currentAnswer(q.id);
    var selectedId = current ? current.selectedOptionId : null;

    (q.options || []).forEach(function (opt) {
      var li = document.createElement("li");
      var label = document.createElement("label");
      label.className = "icac-option";
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "q_" + q.id;
      input.value = opt.id;
      input.checked = selectedId === opt.id;
      input.addEventListener("change", function () {
        answers[q.id] = { questionId: q.id, selectedOptionId: opt.id };
        refreshCurrentDot();
      });
      var span = document.createElement("span");
      span.className = "icac-option__text";
      span.textContent = opt.text;
      label.appendChild(input);
      label.appendChild(span);
      li.appendChild(label);
      list.appendChild(li);
    });

    container.appendChild(list);
  }

  function renderOptionsMultiple(q, container) {
    var list = document.createElement("ul");
    list.className = "icac-options";
    var current = currentAnswer(q.id);
    var selectedIds = current && Array.isArray(current.selectedOptionIds) ? current.selectedOptionIds.slice() : [];

    (q.options || []).forEach(function (opt) {
      var li = document.createElement("li");
      var label = document.createElement("label");
      label.className = "icac-option";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.value = opt.id;
      input.checked = selectedIds.indexOf(opt.id) !== -1;
      input.addEventListener("change", function () {
        var a = answers[q.id] || { questionId: q.id, selectedOptionIds: [] };
        var arr = Array.isArray(a.selectedOptionIds) ? a.selectedOptionIds : [];
        var idx = arr.indexOf(opt.id);
        if (input.checked && idx === -1) arr.push(opt.id);
        if (!input.checked && idx !== -1) arr.splice(idx, 1);
        a.selectedOptionIds = arr;
        answers[q.id] = a;
        refreshCurrentDot();
      });
      var span = document.createElement("span");
      span.className = "icac-option__text";
      span.textContent = opt.text;
      label.appendChild(input);
      label.appendChild(span);
      li.appendChild(label);
      list.appendChild(li);
    });

    container.appendChild(list);
  }

  function renderScale(q, container) {
    var wrap = document.createElement("div");
    wrap.className = "icac-scale";
    var current = currentAnswer(q.id);
    var selectedValue = current ? current.scaleValue : null;
    var options = q.options && q.options.length ? q.options : [1, 2, 3, 4, 5].map(function (n) {
      return { id: String(n), text: String(n) };
    });

    options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icac-scale__option";
      if (selectedValue !== null && String(selectedValue) === String(opt.text)) {
        btn.classList.add("is-selected");
      }
      btn.textContent = opt.text;
      btn.addEventListener("click", function () {
        answers[q.id] = { questionId: q.id, selectedOptionId: opt.id, scaleValue: opt.text };
        refreshCurrentDot();
        renderQuestion();
      });
      wrap.appendChild(btn);
    });

    container.appendChild(wrap);
  }

  function renderText(q, container, isLong) {
    var current = currentAnswer(q.id);
    var value = current ? current.textAnswer || "" : "";

    if (q.readOnly) {
      var input = document.createElement("input");
      input.className = "icac-input";
      input.type = "text";
      input.readOnly = true;
      input.value = value;
      container.appendChild(input);
      var note = document.createElement("p");
      note.className = "icac-readonly-note";
      note.textContent = "Este dato viene de tu registro y no se puede editar.";
      container.appendChild(note);
      return;
    }

    var field = isLong ? document.createElement("textarea") : document.createElement("input");
    field.className = isLong ? "icac-textarea" : "icac-input";
    if (!isLong) field.type = "text";
    field.value = value;
    field.setAttribute("maxlength", "4000");
    field.addEventListener("input", function () {
      answers[q.id] = { questionId: q.id, textAnswer: field.value };
      refreshCurrentDot();
    });
    container.appendChild(field);
  }

  function renderQuestionInput(q) {
    clearNode(els.questionInput);
    switch (q.type) {
      case "Opción única":
      case "Verdadero o falso":
        renderOptionsSingle(q, els.questionInput);
        break;
      case "Opción múltiple":
        renderOptionsMultiple(q, els.questionInput);
        break;
      case "Escala":
      case "Satisfacción":
        renderScale(q, els.questionInput);
        break;
      case "Texto largo":
        renderText(q, els.questionInput, true);
        break;
      default:
        renderText(q, els.questionInput, false);
    }
  }

  function renderDots() {
    clearNode(els.questionDots);
    questions.forEach(function (q, idx) {
      var li = document.createElement("li");
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "icac-question-dot";
      dot.setAttribute("aria-label", "Ir a la pregunta " + (idx + 1));
      dot.textContent = String(idx + 1);
      if (idx === currentIndex) dot.classList.add("is-current");
      markAnswered(dot, isQuestionAnswered(q));
      dot.addEventListener("click", function () {
        currentIndex = idx;
        renderQuestion();
      });
      li.appendChild(dot);
      els.questionDots.appendChild(li);
    });
  }

  function refreshCurrentDot() {
    var dots = els.questionDots.querySelectorAll(".icac-question-dot");
    if (dots[currentIndex]) markAnswered(dots[currentIndex], isQuestionAnswered(questions[currentIndex]));
  }

  function renderQuestion() {
    var q = questions[currentIndex];
    if (!q) return;
    setText(els.quizPosition, "Pregunta " + (currentIndex + 1) + " de " + questions.length);
    setText(els.quizSection, q.section || "");
    var pct = Math.round(((currentIndex + 1) / questions.length) * 100);
    els.progressFill.style.width = pct + "%";

    setText(els.questionSection, q.section || "");
    setText(els.questionText, q.text || "");
    setText(els.questionMeta, q.required ? "Obligatoria" : "Opcional");
    setText(els.quizError, "");
    els.quizError.classList.remove("is-visible");

    renderQuestionInput(q);
    renderDots();

    els.quizPrev.disabled = currentIndex === 0;
    var isLast = currentIndex === questions.length - 1;
    els.quizNext.hidden = isLast;
    els.quizSubmit.hidden = !isLast;
  }

  function onPrevClick() {
    if (currentIndex === 0) return;
    currentIndex--;
    renderQuestion();
  }

  function onNextClick() {
    if (currentIndex >= questions.length - 1) return;
    var q = questions[currentIndex];
    if (q.required && !isQuestionAnswered(q)) {
      setText(els.quizError, "Esta pregunta es obligatoria. Puedes responderla ahora o continuar y volver más tarde.");
      els.quizError.classList.add("is-visible");
    }
    currentIndex++;
    renderQuestion();
  }

  /**
   * Construye la liga de redirección a /resultado/.
   *
   * IMPORTANTE (seguridad): esta función YA NO viaja con calificación,
   * aprobado, elegibilidad ni ningún otro dato de calificación en la URL.
   * Antes lo hacía, y eso permitía que cualquiera editara esos parámetros a
   * simple vista en el navegador y viera un resultado falso. Ahora /resultado/
   * recibe únicamente el Token de resultado (público por diseño, igual que el
   * Token individual) y consulta el resultado real contra el backend seguro
   * GET /icac/public/evaluation/result?token=... (ver assets/js/resultado.js
   * y window.ICAC_API.getResult en assets/js/api.js).
   */
  function buildResultRedirect(data) {
    var params = new URLSearchParams();
    if (data.resultToken) params.set("token", data.resultToken);
    return "../resultado/?" + params.toString();
  }

  function onSubmitClick() {
    if (isBusy) return;
    isBusy = true;
    showOnly(els.submitting);

    var payload = [];
    Object.keys(answers).forEach(function (qid) {
      payload.push(answers[qid]);
    });

    window.ICAC_API.submitAnswers(individualToken, resultToken, payload)
      .then(function (response) {
        if (response.success && response.data) {
          window.location.href = buildResultRedirect(response.data);
          return;
        }
        if (response.code === "ALREADY_SUBMITTED" && response.data) {
          window.location.href = buildResultRedirect(response.data);
          return;
        }
        showOnly(els.quiz);
        setText(els.quizError, response.message || "No pudimos enviar tu evaluación. Intenta de nuevo.");
        els.quizError.classList.add("is-visible");
      })
      .catch(function () {
        showOnly(els.quiz);
        setText(els.quizError, "No pudimos enviar tu evaluación. Intenta de nuevo en unos minutos.");
        els.quizError.classList.add("is-visible");
      })
      .then(function () {
        isBusy = false;
      });
  }

  function init() {
    individualToken = getTokenFromUrl();

    if (!individualToken) {
      showOnly(els.noToken);
      return;
    }

    els.retryButton.addEventListener("click", loadEvaluation);
    els.startButton.addEventListener("click", onStartClick);
    els.quizPrev.addEventListener("click", onPrevClick);
    els.quizNext.addEventListener("click", onNextClick);
    els.quizSubmit.addEventListener("click", onSubmitClick);

    loadEvaluation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
