/**
 * ICAC - Lógica de la página /registro/
 *
 * Reglas de seguridad de este archivo:
 *   - Nunca usa innerHTML con contenido proveniente de la API (siempre textContent).
 *   - Nunca guarda datos personales en localStorage/sessionStorage.
 *   - Nunca imprime el payload completo del formulario a la consola.
 *   - La validación de este archivo es solo para UX; la API vuelve a validar
 *     todo del lado del servidor y es la única fuente de verdad.
 */
(function () {
  "use strict";

  var els = {
    loading: document.getElementById("icac-state-loading"),
    noToken: document.getElementById("icac-state-no-token"),
    error: document.getElementById("icac-state-error"),
    errorTitle: document.getElementById("icac-error-title"),
    errorMessage: document.getElementById("icac-error-message"),
    retryButton: document.getElementById("icac-retry-button"),
    closed: document.getElementById("icac-state-closed"),
    closedTitle: document.getElementById("icac-closed-title"),
    closedMessage: document.getElementById("icac-closed-message"),
    full: document.getElementById("icac-state-full"),
    fullMessage: document.getElementById("icac-full-message"),
    available: document.getElementById("icac-state-available"),
    already: document.getElementById("icac-state-already"),
    alreadyMessage: document.getElementById("icac-already-message"),
    alreadyEvaluationButton: document.getElementById("icac-already-evaluation-button"),
    success: document.getElementById("icac-state-success"),
    successMessage: document.getElementById("icac-success-message"),
    successNextStep: document.getElementById("icac-success-next-step"),
    successEvaluationButton: document.getElementById("icac-success-evaluation-button"),

    courseName: document.getElementById("icac-course-name"),
    courseDescription: document.getElementById("icac-course-description"),
    sessionFacts: document.getElementById("icac-session-facts"),
    publicInstructions: document.getElementById("icac-public-instructions"),
    sessionBadge: document.getElementById("icac-session-badge"),

    form: document.getElementById("icac-register-form"),
    formError: document.getElementById("icac-form-error"),
    submitButton: document.getElementById("icac-submit-button"),
    privacyLink: document.getElementById("icac-privacy-link")
  };

  var ALL_STATE_SECTIONS = [
    els.loading,
    els.noToken,
    els.error,
    els.closed,
    els.full,
    els.available,
    els.already,
    els.success
  ];

  var sessionToken = null;
  var isSubmitting = false;

  function showOnly(section) {
    for (var i = 0; i < ALL_STATE_SECTIONS.length; i++) {
      var el = ALL_STATE_SECTIONS[i];
      if (!el) continue;
      el.hidden = el !== section;
    }
    if (section && typeof section.focus === "function") {
      // No robamos el foco de inputs; solo movemos el foco a estados informativos.
    }
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value === undefined || value === null || value === "" ? "" : String(value);
  }

  function getSessionTokenFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get("session");
    return token ? token.trim() : "";
  }

  function formatDate(iso) {
    if (!iso) return null;
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {
      return null;
    }
  }

  function addFact(label, value) {
    if (!value) return;
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
    els.sessionFacts.appendChild(li);
  }

  function renderSessionData(data) {
    els.sessionFacts.innerHTML = "";

    setText(els.courseName, data.courseName || "Sesión de capacitación");
    setText(els.courseDescription, data.courseDescription || "");

    addFact("Capacitador", data.trainerName);
    addFact("Folio", data.sessionFolio);
    addFact("Fecha de inicio", formatDate(data.startDate));
    addFact("Horario", data.schedule);
    addFact("Modalidad", data.modality);
    if (data.modality && data.modality.toLowerCase() === "virtual" && data.virtualLink) {
      addFact("Liga virtual", data.virtualLink);
    } else {
      addFact("Ubicación", data.publicLocation);
    }
    if (typeof data.availableSpots === "number") {
      addFact("Cupo disponible", String(data.availableSpots));
    }

    setText(els.publicInstructions, data.publicInstructions || "");

    if (typeof data.availableSpots === "number" && data.availableSpots <= 5) {
      els.sessionBadge.classList.add("icac-badge--warning");
      setText(els.sessionBadge, "Pocos lugares disponibles");
    } else {
      els.sessionBadge.classList.remove("icac-badge--warning");
      setText(els.sessionBadge, "Registro abierto");
    }
  }

  function showError(title, message) {
    setText(els.errorTitle, title);
    setText(els.errorMessage, message);
    showOnly(els.error);
  }

  function showClosed(title, message) {
    setText(els.closedTitle, title);
    setText(els.closedMessage, message);
    showOnly(els.closed);
  }

  function showFull(message) {
    setText(els.fullMessage, message);
    showOnly(els.full);
  }

  /**
   * Muestra el botón "Continuar a mi capacitación" cuando la API devuelve
   * un Token individual (participantToken). El token viaja en la URL igual
   * que en el resto del sitio (no se guarda en localStorage/sessionStorage).
   */
  function wireEvaluationButton(buttonEl, data) {
    if (!buttonEl) return;
    if (data && data.participantToken) {
      buttonEl.hidden = false;
      buttonEl.onclick = function () {
        window.location.href = "../evaluacion/?token=" + encodeURIComponent(data.participantToken);
      };
    } else {
      buttonEl.hidden = true;
    }
  }

  function showAlready(data, fallbackMessage) {
    var message = fallbackMessage || "Ya tienes un registro para esta sesión.";
    if (data && data.courseName) {
      message += " Curso: " + data.courseName + ".";
    }
    setText(els.alreadyMessage, message);
    wireEvaluationButton(els.alreadyEvaluationButton, data);
    showOnly(els.already);
  }

  function showSuccess(data, fallbackMessage) {
    setText(els.successMessage, fallbackMessage || "Tu registro fue completado correctamente.");
    if (data && data.nextStep === "WAIT_FOR_EVALUATION") {
      setText(
        els.successNextStep,
        data && data.participantToken
          ? "Cuando tu capacitador habilite la evaluación, podrás presentarla desde el botón de abajo."
          : "Cuando tu capacitador habilite la evaluación, te compartirá cómo acceder a ella."
      );
    } else {
      setText(els.successNextStep, "No necesitas hacer nada más por ahora. ¡Gracias por registrarte!");
    }
    wireEvaluationButton(els.successEvaluationButton, data);
    showOnly(els.success);
  }

  /**
   * Interpreta el código de respuesta de la API de consulta (GET) y decide
   * qué estado de la página mostrar.
   */
  function handleSessionResponse(response) {
    if (response.success) {
      renderSessionData(response.data || {});
      showOnly(els.available);
      return;
    }

    switch (response.code) {
      case "SESSION_NOT_FOUND":
      case "TOKEN_REQUIRED":
      case "INVALID_TOKEN":
        showError(
          "No encontramos tu sesión",
          response.message ||
            "Verifica que el enlace esté completo o vuelve a escanear el código QR."
        );
        break;
      case "SESSION_CANCELLED":
        showClosed("Esta sesión fue cancelada", response.message);
        break;
      case "SESSION_CLOSED":
        showClosed("El registro ya cerró", response.message);
        break;
      case "SESSION_FULL":
        showFull(response.message);
        break;
      default:
        showError(
          "No pudimos cargar tu sesión",
          response.message || "Ocurrió un problema. Intenta de nuevo más tarde."
        );
    }
  }

  function loadSession() {
    showOnly(els.loading);
    window.ICAC_API.getSession(sessionToken).then(handleSessionResponse);
  }

  /* ----------------------------------------------------------------------
   * Validación del formulario (solo UX; la API vuelve a validar todo)
   * ------------------------------------------------------------------- */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var FIELD_VALIDATORS = {
    employeeNumber: function (v) {
      return v.trim().length > 0 && v.trim().length <= 30;
    },
    firstName: function (v) {
      return v.trim().length > 0 && v.trim().length <= 100;
    },
    lastName: function (v) {
      return v.trim().length > 0 && v.trim().length <= 100;
    },
    corporateEmail: function (v) {
      return EMAIL_RE.test(v.trim()) && v.trim().length <= 150;
    },
    personalEmail: function (v) {
      return v.trim() === "" || (EMAIL_RE.test(v.trim()) && v.trim().length <= 150);
    },
    phone: function (v) {
      return v.trim() === "" || v.trim().length <= 20;
    },
    position: function (v) {
      return v.trim().length > 0 && v.trim().length <= 100;
    },
    area: function (v) {
      return v.trim().length > 0 && v.trim().length <= 100;
    },
    client: function () {
      return true;
    },
    installation: function () {
      return true;
    },
    privacyAccepted: function (checked) {
      return checked === true;
    },
    dataConfirmed: function (checked) {
      return checked === true;
    }
  };

  function setFieldError(fieldName, hasError) {
    var wrapper = document.getElementById("field-" + fieldName);
    if (!wrapper) return;
    wrapper.classList.toggle("has-error", !!hasError);
  }

  function readFormValues() {
    var form = els.form;
    return {
      sessionToken: sessionToken,
      employeeNumber: form.employeeNumber.value.trim(),
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      corporateEmail: form.corporateEmail.value.trim(),
      personalEmail: form.personalEmail.value.trim(),
      phone: form.phone.value.trim(),
      position: form.position.value.trim(),
      area: form.area.value.trim(),
      client: form.client.value.trim(),
      installation: form.installation.value.trim(),
      region: "",
      city: "",
      privacyAccepted: form.privacyAccepted.checked === true,
      dataConfirmed: form.dataConfirmed.checked === true
    };
  }

  function validateForm(values) {
    var invalidFields = [];
    Object.keys(FIELD_VALIDATORS).forEach(function (fieldName) {
      var value = values[fieldName];
      var valid = FIELD_VALIDATORS[fieldName](value === undefined ? "" : value);
      setFieldError(fieldName, !valid);
      if (!valid) invalidFields.push(fieldName);
    });
    return invalidFields;
  }

  function setFormError(message) {
    if (!message) {
      els.formError.classList.remove("is-visible");
      setText(els.formError, "");
      return;
    }
    setText(els.formError, message);
    els.formError.classList.add("is-visible");
  }

  function setSubmitting(submitting) {
    isSubmitting = submitting;
    els.submitButton.disabled = submitting;
    setText(els.submitButton, submitting ? "Enviando..." : "Confirmar registro");
  }

  function handleRegisterResponse(response) {
    if (response.success) {
      if (response.code === "ALREADY_REGISTERED") {
        showAlready(response.data, response.message);
      } else {
        showSuccess(response.data, response.message);
      }
      return;
    }

    switch (response.code) {
      case "VALIDATION_ERROR":
        var invalidFields =
          response.data && Array.isArray(response.data.invalidFields) ? response.data.invalidFields : [];
        invalidFields.forEach(function (f) {
          setFieldError(f, true);
        });
        setFormError(response.message || "Revisa los datos marcados en el formulario.");
        break;
      case "SESSION_NOT_FOUND":
      case "SESSION_CANCELLED":
      case "SESSION_CLOSED":
        showClosed("El registro ya no está disponible", response.message);
        break;
      case "SESSION_FULL":
        showFull(response.message);
        break;
      default:
        setFormError(
          response.message || "No pudimos completar tu registro. Intenta de nuevo en unos minutos."
        );
    }
  }

  function onFormSubmit(evt) {
    evt.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    var values = readFormValues();
    var invalidFields = validateForm(values);

    if (invalidFields.length > 0) {
      setFormError("Revisa los campos marcados antes de continuar.");
      return;
    }

    setSubmitting(true);
    window.ICAC_API.registerParticipant(values)
      .then(handleRegisterResponse)
      .catch(function () {
        setFormError("No pudimos completar tu registro. Intenta de nuevo en unos minutos.");
      })
      .then(function () {
        setSubmitting(false);
      });
  }

  function init() {
    if (els.privacyLink && window.ICAC_CONFIG && window.ICAC_CONFIG.privacyNoticeUrl) {
      els.privacyLink.href = window.ICAC_CONFIG.privacyNoticeUrl;
    }

    sessionToken = getSessionTokenFromUrl();

    if (!sessionToken) {
      showOnly(els.noToken);
      return;
    }

    els.retryButton.addEventListener("click", loadSession);
    els.form.addEventListener("submit", onFormSubmit);

    loadSession();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
