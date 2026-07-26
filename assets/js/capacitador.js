/**
 * ICAC - Modo presentación presencial para capacitadores.
 *
 * Página EXCLUSIVA para capacitadores. Se proyecta en una pantalla durante
 * la sesión presencial; los colaboradores NO tienen acceso a este módulo.
 * Todo el control es manual: el capacitador navega los temas, reproduce los
 * videos y muestra los QR con el mouse, el teclado o el panel de control.
 *
 * No registra progreso individual de colaboradores. Solo persiste, de forma
 * opcional, el tema actual y el estatus de la presentación (para poder
 * recargar la página sin perder el avance), mediante
 * ICAC_API.updatePresentation().
 */
(function () {
  "use strict";

  var els = {};
  var state = {
    token: null,
    data: null,
    topics: [], // 4 temas de contenido + registro + evaluacion + cierre, en orden
    currentTopicId: null, // null => pantalla de inicio
    status: "No iniciada"
  };

  var FIXED_TRAILING_TOPICS = [
    { id: "registro", kind: "registro", title: "Registro o asistencia" },
    { id: "evaluacion", kind: "evaluacion", title: "Evaluación" },
    { id: "cierre", kind: "cierre", title: "Cierre" }
  ];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheEls();
    bindStaticEvents();

    var params = new URLSearchParams(window.location.search);
    state.token = (params.get("session") || "").trim();

    if (!state.token) {
      return showError(
        "Token inválido",
        "Falta el acceso de presentación en la liga. Verifica que la URL incluya ?session=... proporcionada para esta sesión."
      );
    }

    loadPresentation();
  }

  function cacheEls() {
    els.stateLoading = document.getElementById("state-loading");
    els.stateError = document.getElementById("state-error");
    els.errorTitle = document.getElementById("error-title");
    els.errorMessage = document.getElementById("error-message");
    els.presentation = document.getElementById("presentation");

    els.tbCourse = document.getElementById("tb-course");
    els.tbTrainer = document.getElementById("tb-trainer");
    els.tbFolio = document.getElementById("tb-folio");
    els.tbTopicIndicator = document.getElementById("tb-topic-indicator");
    els.btnExitFullscreen = document.getElementById("btn-exit-fullscreen");

    els.navList = document.getElementById("nav-list");

    els.screenInicio = document.getElementById("screen-inicio");
    els.screenTema = document.getElementById("screen-tema");
    els.screenRegistro = document.getElementById("screen-registro");
    els.screenEvaluacion = document.getElementById("screen-evaluacion");
    els.screenCierre = document.getElementById("screen-cierre");

    els.startCourse = document.getElementById("start-course");
    els.startTrainer = document.getElementById("start-trainer");
    els.startDate = document.getElementById("start-date");
    els.startLocation = document.getElementById("start-location");
    els.startDuration = document.getElementById("start-duration");
    els.btnStart = document.getElementById("btn-start");
    els.btnShowQrFromStart = document.getElementById("btn-show-qr-from-start");

    els.topicEyebrow = document.getElementById("topic-eyebrow");
    els.topicTitle = document.getElementById("topic-title");
    els.topicSubtitle = document.getElementById("topic-subtitle");
    els.topicVideoWrap = document.getElementById("topic-video-wrap");
    els.topicVideo = document.getElementById("topic-video");
    els.topicVideoUnavailable = document.getElementById("topic-video-unavailable");
    els.topicKeyMessage = document.getElementById("topic-key-message");
    els.topicExtra = document.getElementById("topic-extra");
    els.topicSupportText = document.getElementById("topic-support-text");
    els.btnPrev = document.getElementById("btn-prev");
    els.btnNext = document.getElementById("btn-next");
    els.btnRestartVideo = document.getElementById("btn-restart-video");

    els.qrRegistroBox = document.getElementById("qr-registro-box");
    els.qrRegistroImg = document.getElementById("qr-registro-img");
    els.qrRegistroPlaceholder = document.getElementById("qr-registro-placeholder");
    els.registroFolio = document.getElementById("registro-folio");
    els.registroCourse = document.getElementById("registro-course");
    els.registroStatus = document.getElementById("registro-status");
    els.attendeeTotal = document.getElementById("attendee-total");
    els.attendeeCapacity = document.getElementById("attendee-capacity");
    els.attendeeUpdated = document.getElementById("attendee-updated");
    els.btnRefreshCount = document.getElementById("btn-refresh-count");

    els.evalQrBox = document.getElementById("eval-qr-box");
    els.evalQrImg = document.getElementById("eval-qr-img");
    els.evalUnavailable = document.getElementById("eval-unavailable");
    els.evalTime = document.getElementById("eval-time");
    els.evalMinScore = document.getElementById("eval-min-score");
    els.evalMaxAttempts = document.getElementById("eval-max-attempts");

    els.btnShowEvalFromClose = document.getElementById("btn-show-eval-from-close");
    els.btnEndPresentation = document.getElementById("btn-end-presentation");

    els.controlPanel = document.getElementById("cap-control-panel");
  }

  function bindStaticEvents() {
    els.btnStart.addEventListener("click", function () {
      setStatus("En presentación");
      goToFirstContentTopic();
    });
    els.btnShowQrFromStart.addEventListener("click", function () {
      goToTopic("registro");
    });
    els.btnPrev.addEventListener("click", goToPreviousTopic);
    els.btnNext.addEventListener("click", goToNextTopic);
    els.btnRestartVideo.addEventListener("click", restartVideo);
    els.btnRefreshCount.addEventListener("click", refreshAttendeeCount);
    els.btnShowEvalFromClose.addEventListener("click", function () {
      goToTopic("evaluacion");
    });
    els.btnEndPresentation.addEventListener("click", function () {
      setStatus("Finalizada");
    });
    els.btnExitFullscreen.addEventListener("click", exitFullscreen);

    els.controlPanel.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-action]");
      if (!btn) return;
      handleControlAction(btn.getAttribute("data-action"));
    });

    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("fullscreenchange", updateFullscreenUi);
  }

  function handleControlAction(action) {
    switch (action) {
      case "inicio":
        goToTopic(null);
        break;
      case "prev":
        goToPreviousTopic();
        break;
      case "next":
        goToNextTopic();
        break;
      case "show-video":
        goToFirstVideoTopic();
        break;
      case "restart-video":
        restartVideo();
        break;
      case "show-registro":
        goToTopic("registro");
        break;
      case "show-evaluacion":
        goToTopic("evaluacion");
        break;
      case "show-cierre":
        goToTopic("cierre");
        setStatus("Finalizada");
        break;
      case "fullscreen":
        toggleFullscreen();
        break;
      case "salir":
        exitFullscreen();
        break;
    }
  }

  function handleKeydown(ev) {
    if (els.presentation.hasAttribute("hidden")) return; // aún no cargó
    if (ev.key === "ArrowRight") {
      goToNextTopic();
    } else if (ev.key === "ArrowLeft") {
      goToPreviousTopic();
    } else if (ev.key === "f" || ev.key === "F") {
      toggleFullscreen();
    } else if (ev.key === "Escape") {
      exitFullscreen();
    }
  }

  // ---------------------------------------------------------------------
  // Carga de datos
  // ---------------------------------------------------------------------

  function loadPresentation() {
    ICAC_API.getPresentation(state.token).then(function (resp) {
      if (!resp.success) {
        return handleLoadError(resp);
      }
      state.data = resp.data;

      if (resp.code === "COURSE_WITHOUT_CONTENT" || !resp.data.contents || resp.data.contents.length === 0) {
        return showError(
          "Curso sin contenidos",
          "Esta sesión no tiene contenidos activos configurados para capacitación presencial. Verifica el curso en Airtable."
        );
      }

      state.topics = resp.data.contents
        .slice()
        .sort(function (a, b) {
          return (a.order || 0) - (b.order || 0);
        })
        .map(function (c) {
          return {
            id: c.contentId,
            kind: "contenido",
            section: c.section,
            type: c.type,
            title: c.title,
            subtitle: c.subtitle,
            keyMessage: c.keyMessage,
            description: c.description,
            supportText: c.supportText,
            embedUrl: c.embedUrl,
            duration: c.duration,
            contactEmail: c.contactEmail,
            contactPhone: c.contactPhone
          };
        })
        .concat(FIXED_TRAILING_TOPICS);

      state.status = (resp.data.session && resp.data.session.presentationStatus) || "No iniciada";

      showPresentation();
      renderTopbar();
      renderNav();

      var savedTopic = resp.data.session && resp.data.session.currentTopic;
      if (savedTopic && findTopic(savedTopic)) {
        goToTopic(savedTopic, { persist: false });
      } else {
        goToTopic(null, { persist: false });
      }
    });
  }

  function handleLoadError(resp) {
    var code = resp.code || "TECHNICAL_ERROR";
    var map = {
      INVALID_TOKEN: ["Token inválido", "El acceso de presentación en la liga tiene un formato inválido."],
      TOKEN_INVALID: ["Sesión no encontrada", "No encontramos ninguna sesión asociada a este acceso de presentación."],
      PRESENTATION_DISABLED: ["Presentación deshabilitada", "El acceso de presentación de esta sesión está deshabilitado. Solicita al administrador que lo habilite en Airtable."],
      SESSION_CANCELLED: ["Sesión cancelada", "Esta sesión de capacitación fue cancelada."],
      SESSION_WITHOUT_COURSE: ["Curso sin contenidos", "La sesión no tiene un curso vinculado correctamente."],
      NETWORK_ERROR: ["Error de conexión", "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."],
      INVALID_RESPONSE: ["Error de conexión", "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."]
    };
    var entry = map[code] || ["Acceso no autorizado", resp.message || "No fue posible cargar la presentación."];
    showError(entry[0], entry[1]);
  }

  function showError(title, message) {
    els.stateLoading.hidden = true;
    els.errorTitle.textContent = title;
    els.errorMessage.textContent = message;
    els.stateError.hidden = false;
  }

  function showPresentation() {
    els.stateLoading.hidden = true;
    els.stateError.hidden = true;
    els.presentation.hidden = false;
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  function renderTopbar() {
    var d = state.data;
    els.tbCourse.textContent = (d.course && d.course.name) || "Curso";
    els.tbTrainer.textContent = (d.trainer && d.trainer.name) ? "Capacitador: " + d.trainer.name : "";
    els.tbFolio.textContent = (d.session && d.session.folio) ? "Folio: " + d.session.folio : "";
  }

  function renderNav() {
    els.navList.innerHTML = "";
    var lastSection = null;
    state.topics.forEach(function (topic, idx) {
      var sectionLabel = topic.section || (topic.kind !== "contenido" ? "Cierre del programa" : null);
      if (sectionLabel && sectionLabel !== lastSection) {
        var header = document.createElement("li");
        header.className = "cap-nav__section";
        header.textContent = sectionLabel;
        els.navList.appendChild(header);
        lastSection = sectionLabel;
      }
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cap-nav__item";
      btn.setAttribute("data-topic-id", topic.id);
      btn.innerHTML =
        '<span class="cap-nav__num">' + (idx + 1) + "</span><span>" + escapeHtml(topic.title) + "</span>";
      btn.addEventListener("click", function () {
        goToTopic(topic.id);
      });
      li.appendChild(btn);
      els.navList.appendChild(li);
    });
    updateNavHighlight();
  }

  function updateNavHighlight() {
    var buttons = els.navList.querySelectorAll(".cap-nav__item");
    buttons.forEach(function (btn) {
      var isActive = btn.getAttribute("data-topic-id") === state.currentTopicId;
      btn.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  function renderStartScreen() {
    var d = state.data;
    els.startCourse.textContent = (d.course && d.course.name) || "Código de Ética y Compliance";
    els.startTrainer.textContent = (d.trainer && d.trainer.name) || "Por asignar";
    els.startDate.textContent = formatDate(d.session && d.session.date);
    els.startLocation.textContent = (d.session && d.session.location) || "Por confirmar";
    var hrs = d.course && d.course.estimatedDurationHours;
    els.startDuration.textContent = hrs ? hrs + " hrs" : "Por confirmar";
  }

  function renderTopicScreen(topic) {
    els.topicEyebrow.textContent =
      (topic.section ? topic.section + " · " : "") + "Tema " + (indexOfTopic(topic.id) + 1) + " de " + state.topics.length;
    els.topicTitle.textContent = topic.title || "";
    els.topicSubtitle.textContent = topic.subtitle || "";

    // Para "Indicador" de una sola cifra (ej. 48 h), el mensaje clave YA es la
    // cifra grande: se muestra como estadística en topic-extra en vez de
    // repetirse en el cap-key-message genérico.
    var isSingleStat = topic.type === "Indicador" && topic.description && topic.description.indexOf("|") === -1;
    els.topicKeyMessage.hidden = !!isSingleStat;
    els.topicKeyMessage.textContent = isSingleStat ? "" : topic.keyMessage || "";

    els.topicSupportText.textContent = topic.supportText || "";
    els.topicExtra.innerHTML = "";
    renderTopicExtra(topic);

    if (topic.embedUrl) {
      els.topicVideo.src = topic.embedUrl;
      els.topicVideoWrap.hidden = false;
      els.topicVideoUnavailable.hidden = true;
    } else {
      els.topicVideo.src = "";
      els.topicVideoWrap.hidden = true;
      els.topicVideoUnavailable.hidden = true; // solo "Principio ético" espera video; el resto no lo anuncia como faltante
    }

    els.btnPrev.disabled = indexOfTopic(topic.id) === 0;
    els.btnNext.disabled = indexOfTopic(topic.id) === state.topics.length - 1;
  }

  /**
   * Renderiza el bloque de contenido según el "Tipo de contenido" de Airtable:
   * Tarjetas -> grid de tarjetas; Diagrama -> nodos + párrafo; Indicador ->
   * cifra(s) grande(s); Canal de denuncia -> correo/teléfono destacados;
   * Compromiso -> bloque de compromiso; el resto (Texto/Introducción/
   * Principio ético) cae en el párrafo genérico ya cubierto por
   * topic-support-text, así que aquí solo se agrega la Descripción como
   * párrafo adicional cuando aplica.
   */
  function renderTopicExtra(topic) {
    var desc = topic.description || "";
    var container = els.topicExtra;

    if (topic.type === "Tarjetas") {
      var grid = document.createElement("div");
      grid.className = "cap-cards-grid";
      desc.split("\n").filter(Boolean).forEach(function (line) {
        var idx = line.indexOf(":");
        var card = document.createElement("div");
        card.className = "cap-card";
        if (idx > -1 && idx < 40) {
          card.innerHTML =
            '<p class="cap-card__title">' + escapeHtml(line.slice(0, idx)) + "</p>" +
            '<p class="cap-card__body">' + escapeHtml(line.slice(idx + 1).trim()) + "</p>";
        } else {
          card.innerHTML = '<p class="cap-card__body">' + escapeHtml(line) + "</p>";
        }
        grid.appendChild(card);
      });
      container.appendChild(grid);
      return;
    }

    if (topic.type === "Diagrama") {
      var parts = desc.split("\n—\n");
      var nodeLines = (parts[0] || "").split("\n").filter(Boolean);
      var paragraph = parts.slice(1).join("\n—\n");
      if (nodeLines.length) {
        var nodes = document.createElement("div");
        nodes.className = "cap-diagram-nodes";
        nodeLines.forEach(function (n) {
          var node = document.createElement("div");
          node.className = "cap-diagram-node";
          node.textContent = n;
          nodes.appendChild(node);
        });
        container.appendChild(nodes);
      }
      if (paragraph) {
        var p = document.createElement("p");
        p.className = "cap-support-text";
        p.style.maxWidth = "820px";
        p.textContent = paragraph;
        container.appendChild(p);
      }
      return;
    }

    if (topic.type === "Indicador") {
      var lines = desc.split("\n").filter(Boolean);
      var row = document.createElement("div");
      row.className = "cap-stats-row";
      if (lines.length && lines[0].indexOf("|") > -1) {
        lines.forEach(function (line) {
          var bits = line.split("|");
          var stat = document.createElement("div");
          stat.className = "cap-stat";
          stat.innerHTML =
            '<p class="cap-stat__num">' + escapeHtml(bits[0] || "") + "</p>" +
            '<p class="cap-stat__label">' + escapeHtml(bits[1] || "") + "</p>" +
            '<p class="cap-stat__detail">' + escapeHtml(bits[2] || "") + "</p>";
          row.appendChild(stat);
        });
      } else {
        // Cifra única: el número grande viene en Mensaje clave.
        var stat2 = document.createElement("div");
        stat2.className = "cap-stat";
        stat2.innerHTML =
          '<p class="cap-stat__num">' + escapeHtml(topic.keyMessage || "") + "</p>" +
          '<p class="cap-stat__label">' + escapeHtml(desc) + "</p>";
        row.appendChild(stat2);
      }
      container.appendChild(row);
      return;
    }

    if (topic.type === "Canal de denuncia") {
      if (desc) {
        var p2 = document.createElement("p");
        p2.className = "cap-support-text";
        p2.style.maxWidth = "820px";
        p2.textContent = desc;
        container.appendChild(p2);
      }
      if (topic.contactEmail || topic.contactPhone) {
        var cgrid = document.createElement("div");
        cgrid.className = "cap-contact-grid";
        if (topic.contactEmail) {
          var box1 = document.createElement("div");
          box1.className = "cap-contact-box";
          box1.innerHTML =
            '<p class="cap-contact-box__label">Correo electrónico</p><p class="cap-contact-box__value">' +
            escapeHtml(topic.contactEmail) + "</p>";
          cgrid.appendChild(box1);
        }
        if (topic.contactPhone) {
          var box2 = document.createElement("div");
          box2.className = "cap-contact-box";
          box2.innerHTML =
            '<p class="cap-contact-box__label">Teléfono</p><p class="cap-contact-box__value">' +
            escapeHtml(topic.contactPhone) + "</p>";
          cgrid.appendChild(box2);
        }
        container.appendChild(cgrid);
      }
      return;
    }

    if (topic.type === "Compromiso") {
      if (desc) {
        var commit = document.createElement("div");
        commit.className = "cap-commitment-box";
        commit.textContent = desc;
        container.appendChild(commit);
      }
      return;
    }

    // Texto / Introducción / Principio ético: la Descripción (si existe) se
    // muestra como párrafo adicional bajo el mensaje clave.
    if (desc) {
      var pDefault = document.createElement("p");
      pDefault.className = "cap-support-text";
      pDefault.style.maxWidth = "820px";
      pDefault.textContent = desc;
      container.appendChild(pDefault);
    }
  }

  function renderRegistroScreen() {
    var s = state.data.session || {};
    els.registroFolio.textContent = s.folio || "—";
    els.registroCourse.textContent = (state.data.course && state.data.course.name) || "—";

    if (s.qrUrl) {
      els.qrRegistroImg.src = s.qrUrl;
      els.qrRegistroBox.hidden = false;
      els.qrRegistroPlaceholder.hidden = true;
    } else {
      els.qrRegistroBox.hidden = true;
      els.qrRegistroPlaceholder.hidden = false;
    }

    setStatusPill(els.registroStatus, s.registrationOpen, "Registro abierto", "Registro cerrado");
    updateAttendeeCount();
  }

  function updateAttendeeCount() {
    var s = state.data.session || {};
    els.attendeeTotal.textContent = s.totalRegistered != null ? String(s.totalRegistered) : "—";
    els.attendeeCapacity.textContent = s.capacity != null ? String(s.capacity) : "Sin límite";
    els.attendeeUpdated.textContent = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }

  function renderEvaluacionScreen() {
    var s = state.data.session || {};
    var ev = state.data.evaluation || {};

    if (ev.available) {
      if (s.qrUrl) {
        els.evalQrImg.src = s.qrUrl;
        els.evalQrBox.hidden = false;
      } else {
        els.evalQrBox.hidden = true;
      }
      els.evalUnavailable.hidden = true;
    } else {
      els.evalQrBox.hidden = true;
      els.evalUnavailable.hidden = false;
    }

    els.evalMinScore.textContent = ev.minScore != null ? ev.minScore + "%" : "—";
    els.evalMaxAttempts.textContent = ev.maxAttempts != null ? String(ev.maxAttempts) : "—";
    els.evalTime.textContent = "Variable según el cuestionario";
  }

  function setStatusPill(el, isOpen, openText, closedText) {
    el.textContent = isOpen ? openText : closedText;
    el.classList.toggle("cap-status-pill--open", !!isOpen);
    el.classList.toggle("cap-status-pill--closed", !isOpen);
  }

  // ---------------------------------------------------------------------
  // Navegación entre pantallas
  // ---------------------------------------------------------------------

  function findTopic(id) {
    for (var i = 0; i < state.topics.length; i++) {
      if (state.topics[i].id === id) return state.topics[i];
    }
    return null;
  }

  function indexOfTopic(id) {
    for (var i = 0; i < state.topics.length; i++) {
      if (state.topics[i].id === id) return i;
    }
    return -1;
  }

  function hideAllScreens() {
    [els.screenInicio, els.screenTema, els.screenRegistro, els.screenEvaluacion, els.screenCierre].forEach(function (s) {
      s.hidden = true;
    });
  }

  function goToTopic(id, opts) {
    opts = opts || {};
    hideAllScreens();

    if (!id) {
      state.currentTopicId = null;
      renderStartScreen();
      els.screenInicio.hidden = false;
      els.tbTopicIndicator.textContent = "Inicio";
      updateNavHighlight();
      if (opts.persist !== false) persistState(null, state.status);
      return;
    }

    var topic = findTopic(id);
    if (!topic) return;

    state.currentTopicId = id;
    updateNavHighlight();
    els.tbTopicIndicator.textContent = topic.title;

    if (topic.kind === "contenido") {
      renderTopicScreen(topic);
      els.screenTema.hidden = false;
    } else if (topic.kind === "registro") {
      renderRegistroScreen();
      els.screenRegistro.hidden = false;
    } else if (topic.kind === "evaluacion") {
      renderEvaluacionScreen();
      els.screenEvaluacion.hidden = false;
    } else if (topic.kind === "cierre") {
      els.screenCierre.hidden = false;
    }

    if (opts.persist !== false) persistState(id, state.status);
  }

  function goToFirstContentTopic() {
    var first = state.topics.filter(function (t) {
      return t.kind === "contenido";
    })[0];
    if (first) goToTopic(first.id);
  }

  function goToLastContentTopic() {
    var lastId = state.currentTopicId;
    var topic = findTopic(lastId);
    if (topic && topic.kind === "contenido") return; // ya estamos en un tema de contenido
    var contentTopics = state.topics.filter(function (t) {
      return t.kind === "contenido";
    });
    if (contentTopics.length) goToTopic(contentTopics[0].id);
  }

  /**
   * Botón "Mostrar video" del panel de control: salta al primero de los 4
   * temas ("Principio ético") que tiene video asociado (Integridad,
   * Competencia justa, Conflicto de interés, Información confidencial).
   */
  function goToFirstVideoTopic() {
    var withVideo = state.topics.filter(function (t) {
      return t.kind === "contenido" && t.embedUrl;
    });
    if (withVideo.length) goToTopic(withVideo[0].id);
  }

  function goToNextTopic() {
    if (state.currentTopicId === null) return goToFirstContentTopic();
    var idx = indexOfTopic(state.currentTopicId);
    if (idx === -1 || idx >= state.topics.length - 1) return;
    goToTopic(state.topics[idx + 1].id);
  }

  function goToPreviousTopic() {
    if (state.currentTopicId === null) return;
    var idx = indexOfTopic(state.currentTopicId);
    if (idx <= 0) return goToTopic(null);
    goToTopic(state.topics[idx - 1].id);
  }

  function restartVideo() {
    var topic = findTopic(state.currentTopicId);
    if (!topic || topic.kind !== "contenido" || !topic.embedUrl) return;
    els.topicVideo.src = "";
    // Reasignar en el siguiente ciclo de render fuerza a YouTube a reiniciar el video.
    window.setTimeout(function () {
      els.topicVideo.src = topic.embedUrl;
    }, 30);
  }

  function refreshAttendeeCount() {
    ICAC_API.getPresentation(state.token).then(function (resp) {
      if (!resp.success || !resp.data) return;
      state.data.session.totalRegistered = resp.data.session.totalRegistered;
      state.data.session.capacity = resp.data.session.capacity;
      state.data.session.registrationOpen = resp.data.session.registrationOpen;
      state.data.session.qrUrl = resp.data.session.qrUrl;
      if (state.currentTopicId === "registro") renderRegistroScreen();
      else updateAttendeeCount();
    });
  }

  function setStatus(newStatus) {
    state.status = newStatus;
    persistState(state.currentTopicId, newStatus);
  }

  function persistState(topicId, status) {
    if (!state.token) return;
    ICAC_API.updatePresentation(state.token, topicId, status);
  }

  // ---------------------------------------------------------------------
  // Pantalla completa
  // ---------------------------------------------------------------------

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      exitFullscreen();
    } else if (els.presentation.requestFullscreen) {
      els.presentation.requestFullscreen().catch(function () {});
    }
  }

  function exitFullscreen() {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
  }

  function updateFullscreenUi() {
    els.btnExitFullscreen.hidden = !document.fullscreenElement;
  }

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  function formatDate(iso) {
    if (!iso) return "Por confirmar";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "Por confirmar";
    return d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
