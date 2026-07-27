(function () {
  "use strict";

  var state = {
    token: "",
    data: null,
    topics: [],
    currentId: null,
    status: "No iniciada",
    navOpen: true,
    currentVideo: null
  };

  var el = {};
  var fixed = [
    { id: "registro", kind: "registro", section: "Operación", title: "Registro" },
    { id: "evaluacion", kind: "evaluacion", section: "Operación", title: "Evaluación" },
    { id: "cierre", kind: "cierre", section: "Cierre", title: "Cierre" }
  ];

  var visualMap = [
    { test: /misión|mision|propósito|proposito/i, image: "slide-02.jpg", accent: "mission" },
    { test: /fundamento|relaciones comerciales|expectativas|estándares|estandares|cumplimiento/i, image: "slide-03.jpg", accent: "foundation" },
    { test: /confianza|cadena de valor|largo plazo/i, image: "slide-04.jpg", accent: "trust" },
    { test: /alcance|aplicación|aplicacion|proveedores|suministradores|empleados/i, image: "slide-05.jpg", accent: "scope" },
    { test: /derechos fundamentales|dignidad|trabajo forzado|trabajo infantil|menores|15 años|18 años/i, image: "slide-06.jpg", accent: "rights" },
    { test: /horario|jornada|48 horas|24 horas|12 horas|salarios|no discriminación|no discriminacion|libertad de asociación|asociacion/i, image: "slide-07.jpg", accent: "labor" },
    { test: /salud|seguridad|epp|emergencia|riesgos|proteger/i, image: "slide-08.jpg", accent: "safety" },
    { test: /fidelidad|leyes|integridad|beneficios indebidos|competencia justa|soborno/i, image: "slide-09.jpg", accent: "ethics" },
    { test: /información confidencial|informacion confidencial|conflicto de interés|conflicto de interes|propiedad intelectual|decisiones objetivas/i, image: "slide-10.jpg", accent: "assets" },
    { test: /cadena de suministro|aduanas|importación|importacion|exportación|exportacion|registros fidedignos|minerales de conflicto|aprovisionamiento/i, image: "slide-11.jpg", accent: "supply" },
    { test: /medio ambiente|medioambiental|sustancias peligrosas|restricciones de productos|reciclaje|permisos/i, image: "slide-12.jpg", accent: "environment" },
    { test: /canal de denuncia|denuncia|represalias|confidencial/i, image: "slide-13.jpg", accent: "whistle" },
    { test: /compromiso|adhesión|adhesion|firma/i, image: "slide-14.jpg", accent: "commitment" }
  ];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cache();
    bind();
    state.token = (new URLSearchParams(location.search).get("session") || "").trim();
    if (!state.token) {
      showError("Acceso incompleto", "La liga no contiene el token de presentación de la sesión.");
      return;
    }
    load();
  }

  function cache() {
    [
      "state-loading", "state-error", "error-title", "error-message", "presentation",
      "tb-course", "tb-trainer", "tb-folio", "tb-topic-indicator", "progress-text", "progress-bar",
      "btn-exit-fullscreen", "btn-nav-toggle", "btn-nav-close", "cap-nav", "nav-list", "cap-main",
      "screen-inicio", "screen-tema", "screen-registro", "screen-evaluacion", "screen-cierre",
      "start-course", "start-trainer", "start-date", "start-location", "start-duration", "btn-start",
      "btn-show-qr-from-start", "topic-stage", "topic-context-actions", "registro-status", "registro-folio",
      "registro-course", "attendee-total", "attendee-capacity", "attendee-updated", "btn-refresh-count",
      "qr-registro-box", "qr-registro-img", "qr-registro-placeholder", "eval-qr-box", "eval-qr-img",
      "eval-unavailable", "eval-time", "eval-min-score", "eval-max-attempts", "btn-show-eval-from-close",
      "btn-end-presentation", "cierre-contacto", "cap-control-panel", "video-modal", "video-modal-title",
      "video-modal-frame", "btn-restart-video"
    ].forEach(function (id) {
      el[id.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); })] = document.getElementById(id);
    });
  }

  function bind() {
    el.btnStart.addEventListener("click", function () {
      setStatus("En presentación");
      firstContent();
    });
    el.btnShowQrFromStart.addEventListener("click", function () { go("registro"); });
    el.btnRefreshCount.addEventListener("click", refreshCount);
    el.btnShowEvalFromClose.addEventListener("click", function () { go("evaluacion"); });
    el.btnEndPresentation.addEventListener("click", function () {
      setStatus("Finalizada");
      toast("Presentación finalizada");
    });
    el.btnNavToggle.addEventListener("click", toggleNav);
    el.btnNavClose.addEventListener("click", toggleNav);
    el.btnExitFullscreen.addEventListener("click", exitFullscreen);
    el.capControlPanel.addEventListener("click", function (event) {
      var button = event.target.closest("[data-action]");
      if (button) action(button.dataset.action);
    });
    document.addEventListener("click", function (event) {
      var jump = event.target.closest("[data-jump]");
      if (jump) go(jump.dataset.jump);
      if (event.target.closest("[data-close-video]")) closeVideo();
      var open = event.target.closest("[data-open-video]");
      if (open) openVideo(open.dataset.openVideo);
    });
    el.btnRestartVideo.addEventListener("click", restartVideo);
    document.addEventListener("keydown", keys);
    document.addEventListener("fullscreenchange", fullscreenUi);
  }

  function load() {
    ICAC_API.getPresentation(state.token).then(function (response) {
      if (!response || !response.success) {
        loadError(response || {});
        return;
      }
      state.data = response.data || {};
      var contents = (state.data.contents || []).slice().sort(function (a, b) {
        return (+a.order || 0) - (+b.order || 0);
      });
      if (!contents.length) {
        showError("Curso sin contenidos", "No hay contenidos activos configurados para esta capacitación.");
        return;
      }
      state.topics = contents.map(normalize).concat(fixed);
      state.status = (state.data.session && state.data.session.presentationStatus) || "No iniciada";
      el.stateLoading.hidden = true;
      el.presentation.hidden = false;
      renderTop();
      renderNav();
      renderStart();
      var saved = state.data.session && state.data.session.currentTopic;
      go(saved && find(saved) ? saved : null, false);
    }).catch(function () {
      showError("Error de conexión", "No fue posible consultar la presentación. Verifica la conexión y que el workflow esté activo.");
    });
  }

  function normalize(content) {
    var topic = {
      id: content.contentId,
      kind: "contenido",
      order: +content.order || 0,
      section: content.section || "Contenido",
      type: content.type || "Texto",
      title: content.title || "Contenido",
      subtitle: content.subtitle || "",
      keyMessage: content.keyMessage || "",
      description: content.description || "",
      supportText: content.supportText || "",
      embedUrl: content.embedUrl || "",
      duration: content.duration || "",
      contactEmail: content.contactEmail || "",
      contactPhone: content.contactPhone || ""
    };
    var visual = resolveVisual(topic);
    topic.visual = visual.image;
    topic.accent = visual.accent;
    return topic;
  }

  function resolveVisual(topic) {
    var haystack = [topic.section, topic.type, topic.title, topic.subtitle, topic.keyMessage, topic.description, topic.supportText].join(" ");
    for (var i = 0; i < visualMap.length; i += 1) {
      if (visualMap[i].test.test(haystack)) return visualMap[i];
    }
    return { image: "slide-03.jpg", accent: "default" };
  }

  function loadError(response) {
    var map = {
      INVALID_TOKEN: ["Token inválido", "La liga de presentación no tiene un formato válido."],
      TOKEN_INVALID: ["Sesión no encontrada", "No existe una presentación asociada a este acceso."],
      PRESENTATION_DISABLED: ["Presentación deshabilitada", "Habilita el acceso de presentación desde Airtable."],
      SESSION_CANCELLED: ["Sesión cancelada", "Esta sesión fue cancelada."],
      COURSE_WITHOUT_CONTENT: ["Curso sin contenidos", "No hay contenidos activos para esta sesión."]
    };
    var message = map[response.code] || ["No se pudo cargar", "El backend devolvió un error. Revisa el workflow de consulta de presentación."];
    showError(message[0], message[1]);
  }

  function showError(title, message) {
    el.stateLoading.hidden = true;
    el.presentation.hidden = true;
    el.stateError.hidden = false;
    el.errorTitle.textContent = title;
    el.errorMessage.textContent = message;
  }

  function renderTop() {
    var session = state.data.session || {};
    var course = state.data.course || {};
    var trainer = state.data.trainer || {};
    el.tbCourse.textContent = course.name || "Capacitación";
    el.tbTrainer.textContent = trainer.name || session.trainer || "";
    el.tbFolio.textContent = session.folio || "";
  }

  function renderStart() {
    var session = state.data.session || {};
    var course = state.data.course || {};
    var trainer = state.data.trainer || {};
    el.startCourse.textContent = course.name || "Código de Ética y Compliance";
    el.startTrainer.textContent = trainer.name || session.trainer || "Por confirmar";
    el.startDate.textContent = formatDate(session.startDate || session.start);
    el.startLocation.textContent = session.location || session.modality || "Por confirmar";
    el.startDuration.textContent = course.duration || session.duration || "Según agenda";
  }

  function renderNav() {
    el.navList.innerHTML = "";
    var groups = {};
    state.topics.forEach(function (topic) {
      (groups[topic.section] || (groups[topic.section] = [])).push(topic);
    });
    Object.keys(groups).forEach(function (section) {
      var wrap = document.createElement("section");
      wrap.className = "cap-nav-group";
      var heading = document.createElement("button");
      heading.type = "button";
      heading.className = "cap-nav-group__title";
      heading.innerHTML = "<span>" + esc(section) + "</span><span class=\"cap-nav-chevron\">⌄</span>";
      var list = document.createElement("div");
      list.className = "cap-nav-group__items";
      groups[section].forEach(function (topic) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "cap-nav-item";
        button.dataset.topic = topic.id;
        button.innerHTML = '<span class="cap-nav-item__num">' + String(topic.order || "•").padStart(2, "0") + '</span><span class="cap-nav-item__copy">' + esc(topic.title) + "</span>";
        button.addEventListener("click", function () {
          go(topic.id);
          if (innerWidth < 1000) toggleNav(false);
        });
        list.appendChild(button);
      });
      heading.addEventListener("click", function () {
        wrap.classList.toggle("is-collapsed");
      });
      wrap.appendChild(heading);
      wrap.appendChild(list);
      el.navList.appendChild(wrap);
    });
  }

  function go(id, persist) {
    state.currentId = id || null;
    [el.screenInicio, el.screenTema, el.screenRegistro, el.screenEvaluacion, el.screenCierre].forEach(function (screen) {
      screen.hidden = true;
    });

    if (!id) {
      renderStart();
      el.screenInicio.hidden = false;
      el.tbTopicIndicator.textContent = "Inicio";
    } else {
      var topic = find(id);
      if (!topic) return;
      el.tbTopicIndicator.textContent = topic.title;
      if (topic.kind === "contenido") {
        renderTopic(topic);
        el.screenTema.hidden = false;
      } else if (topic.kind === "registro") {
        renderRegistro();
        el.screenRegistro.hidden = false;
      } else if (topic.kind === "evaluacion") {
        renderEvaluacion();
        el.screenEvaluacion.hidden = false;
      } else if (topic.kind === "cierre") {
        el.screenCierre.hidden = false;
      }
    }

    updateNav();
    updateProgress();
    animateScreen();
    if (persist !== false) persistState(id, state.status);
  }

  function renderTopic(topic) {
    var type = (topic.type || "").toLowerCase();
    var title = (topic.title || "").toLowerCase();
    var html;

    if (type.indexOf("portada") >= 0) html = hero(topic);
    else if (isLaborStats(topic)) html = laborStats(topic);
    else if (isAgeLimits(topic)) html = ageLimits(topic);
    else if (type.indexOf("tarjeta") >= 0 || title.indexOf("fundamento") >= 0) html = cards(topic);
    else if (type.indexOf("diagrama") >= 0 || title.indexOf("alcance") >= 0) html = diagram(topic);
    else if (type.indexOf("canal") >= 0 || title.indexOf("denuncia") >= 0) html = whistle(topic);
    else if (type.indexOf("compromiso") >= 0 || title.indexOf("compromiso") >= 0) html = commitment(topic);
    else if (topic.embedUrl) html = videoPrinciple(topic);
    else if (type.indexOf("principio") >= 0 || title.indexOf("principio") >= 0) html = principle(topic);
    else html = visualStory(topic);

    el.topicStage.innerHTML = html;
    renderContextActions(topic);
  }

  function isLaborStats(topic) {
    var text = allText(topic).join(" ");
    return /48\s*horas|24\s*horas|12\s*horas/i.test(text);
  }

  function isAgeLimits(topic) {
    var text = [topic.title].concat(allText(topic)).join(" ");
    return /15\s*años|18\s*años|menores/i.test(text);
  }

  function baseHead(topic) {
    return '<div class="cap-heading"><p class="cap-eyebrow">' + esc(topic.section) + '</p><h1 class="cap-title">' + esc(topic.title) + "</h1>" + (topic.subtitle ? '<p class="cap-lead">' + esc(topic.subtitle) + "</p>" : "") + "</div>";
  }

  function allText(topic) {
    return [topic.keyMessage, topic.description, topic.supportText].filter(Boolean);
  }

  function splitItems(topic) {
    var raw = [topic.description, topic.supportText].filter(Boolean).join("\n");
    var items = raw.split(/\n|\||•|(?=\d+\.\s)/).map(function (item) {
      return item.replace(/^[-–—]\s*/, "").trim();
    }).filter(Boolean);
    if (items.length < 2) {
      items = raw.split(/;(?=\s*[A-ZÁÉÍÓÚÑ0-9])/).map(function (item) { return item.trim(); }).filter(Boolean);
    }
    return items;
  }

  function textBlocks(topic) {
    var blocks = [];
    if (topic.keyMessage) {
      blocks.push('<div class="cap-message"><span>Mensaje clave</span><strong>' + esc(topic.keyMessage) + "</strong></div>");
    }
    var items = splitItems(topic);
    if (items.length >= 2) {
      blocks.push('<ul class="cap-bullet-list">' + items.map(function (item) {
        var parts = item.split(":");
        if (parts.length > 1 && parts[0].length < 70) {
          return "<li><strong>" + esc(parts.shift()) + ":</strong><span>" + esc(parts.join(":")) + "</span></li>";
        }
        return "<li><span>" + esc(item) + "</span></li>";
      }).join("") + "</ul>");
    } else {
      [topic.description, topic.supportText].filter(Boolean).forEach(function (text) {
        blocks.push('<p class="cap-body-paragraph">' + esc(text) + "</p>");
      });
    }
    return blocks.join("");
  }

  function visualPanel(topic, options) {
    options = options || {};
    var image = "../assets/img/capacitador/" + topic.visual;
    var video = topic.embedUrl;
    var label = options.label || "Referencia visual del contenido";
    var action = video ? '<button type="button" class="cap-visual-video" data-open-video="' + esc(topic.id) + '"><span class="cap-play-button">▶</span><span><strong>Reproducir video</strong><small>' + esc(topic.duration || "Recurso audiovisual") + "</small></span></button>" : "";
    return '<aside class="cap-visual-panel cap-visual-panel--' + esc(topic.accent) + '">' +
      '<div class="cap-visual-frame"><img src="' + image + '" alt="' + esc(label) + '" loading="eager" /><div class="cap-visual-shine"></div></div>' +
      action +
      '<div class="cap-visual-caption"><span>Material oficial INTER-CON</span><strong>' + esc(topic.title) + "</strong></div>" +
      "</aside>";
  }

  function hero(topic) {
    return '<article class="cap-layout cap-layout--hero">' +
      '<div class="cap-copy-column">' + baseHead(topic) + textBlocks(topic) + "</div>" +
      visualPanel(topic) +
      "</article>";
  }

  function cards(topic) {
    var items = splitItems(topic);
    if (items.length < 2) items = allText(topic);
    var cardsHtml = items.map(function (item, index) {
      var parts = item.split(":");
      var heading = parts.length > 1 ? parts.shift() : "Punto " + (index + 1);
      var body = parts.length ? parts.join(":") : item;
      return '<article class="cap-info-card cap-stagger" style="--i:' + index + '"><span class="cap-info-card__number">' + String(index + 1).padStart(2, "0") + '</span><h3>' + esc(heading) + "</h3><p>" + esc(body) + "</p></article>";
    }).join("");
    return '<article class="cap-layout cap-layout--wide"><div class="cap-copy-column cap-copy-column--wide">' + baseHead(topic) + '<div class="cap-info-grid">' + cardsHtml + "</div></div>" + visualPanel(topic) + "</article>";
  }

  function diagram(topic) {
    var items = splitItems(topic);
    return '<article class="cap-layout cap-layout--wide"><div class="cap-copy-column cap-copy-column--wide">' + baseHead(topic) +
      '<div class="cap-flow-map"><div class="cap-flow-map__core">Código de Ética</div>' + items.map(function (item, index) {
        return '<div class="cap-flow-map__node cap-stagger" style="--i:' + index + '"><span>' + String(index + 1).padStart(2, "0") + "</span><strong>" + esc(item) + "</strong></div>";
      }).join("") + "</div></div>" + visualPanel(topic) + "</article>";
  }

  function laborStats(topic) {
    var source = allText(topic).join(" ");
    var figures = [
      { value: "48", unit: "horas", label: extractSentence(source, /48\s*horas[^.;]*/i) || "Jornada regular máxima por semana" },
      { value: "24", unit: "horas", label: extractSentence(source, /24\s*horas[^.;]*/i) || "Descanso mínimo cada siete días" },
      { value: "12", unit: "horas", label: extractSentence(source, /12\s*horas[^.;]*/i) || "Máximo de horas extra voluntarias" }
    ];
    return '<article class="cap-layout cap-layout--stats"><div class="cap-copy-column cap-copy-column--wide">' + baseHead(topic) +
      '<div class="cap-stat-ribbon">' + figures.map(function (figure, index) {
        return '<article class="cap-stat cap-stagger" style="--i:' + index + '"><div><strong data-count="' + figure.value + '">' + figure.value + '</strong><span>' + figure.unit + '</span></div><p>' + esc(figure.label.replace(/^.*?\d+\s*horas?\s*[:\-–]?\s*/i, "")) + "</p></article>";
      }).join("") + "</div>" + (topic.supportText ? '<p class="cap-body-paragraph cap-body-paragraph--center">' + esc(topic.supportText) + "</p>" : "") + "</div>" + visualPanel(topic) + "</article>";
  }

  function ageLimits(topic) {
    var text = allText(topic).join(" ");
    return '<article class="cap-layout cap-layout--wide"><div class="cap-copy-column cap-copy-column--wide">' + baseHead(topic) +
      '<div class="cap-age-grid"><article class="cap-age-card cap-age-card--red"><span>Menores de</span><strong data-count="15">15</strong><em>años</em><p>Prohibición total de trabajo infantil conforme al contenido oficial.</p></article>' +
      '<article class="cap-age-card cap-age-card--yellow"><span>Menores de</span><strong data-count="18">18</strong><em>años</em><p>No deben realizar actividades peligrosas o que comprometan su seguridad, salud o desarrollo.</p></article></div>' +
      '<div class="cap-message"><span>Principio</span><strong>' + esc(topic.keyMessage || text) + "</strong></div></div>" + visualPanel(topic) + "</article>";
  }

  function principle(topic) {
    return '<article class="cap-layout cap-layout--principle"><div class="cap-copy-column"><div class="cap-principle-badge">' + esc(extractNumber(topic.title)) + "</div>" + baseHead(topic) + textBlocks(topic) + "</div>" + visualPanel(topic) + "</article>";
  }

  function videoPrinciple(topic) {
    return '<article class="cap-layout cap-layout--principle"><div class="cap-copy-column"><div class="cap-principle-badge">' + esc(extractNumber(topic.title)) + "</div>" + baseHead(topic) + textBlocks(topic) +
      '<button class="cap-inline-video" type="button" data-open-video="' + esc(topic.id) + '"><span class="cap-play-button">▶</span><span><strong>Ver recurso audiovisual</strong><small>' + esc(topic.duration || "Video de apoyo") + "</small></span></button></div>" +
      visualPanel(topic, { label: "Recurso visual del principio " + topic.title }) + "</article>";
  }

  function whistle(topic) {
    return '<article class="cap-layout cap-layout--whistle"><div class="cap-copy-column">' + baseHead(topic) +
      '<div class="cap-confidential-banner">100% confidencial y estrictamente sin represalias</div>' +
      '<div class="cap-contact-grid">' +
      (topic.contactEmail ? '<article><span>Correo electrónico</span><strong>' + esc(topic.contactEmail) + "</strong></article>" : "") +
      (topic.contactPhone ? '<article><span>Teléfono</span><strong>' + esc(topic.contactPhone) + "</strong></article>" : "") +
      "</div>" + textBlocks(topic) + "</div>" + visualPanel(topic) + "</article>";
  }

  function commitment(topic) {
    return '<article class="cap-layout cap-layout--commitment"><div class="cap-copy-column">' + baseHead(topic) +
      '<blockquote class="cap-commitment-quote">' + esc(topic.keyMessage || topic.description || "") + "</blockquote>" +
      (topic.supportText ? '<p class="cap-body-paragraph">' + esc(topic.supportText) + "</p>" : "") +
      '<div class="cap-signature-lines"><span>Nombre y firma</span><span>Cargo u organización</span></div></div>' + visualPanel(topic) + "</article>";
  }

  function visualStory(topic) {
    return '<article class="cap-layout cap-layout--story"><div class="cap-copy-column">' + baseHead(topic) + textBlocks(topic) + "</div>" + visualPanel(topic) + "</article>";
  }

  function renderContextActions(topic) {
    var html = '<button class="cap-btn cap-btn--ghost" data-topic-action="prev" type="button">← Anterior</button>';
    if (topic.embedUrl) {
      html += '<button class="cap-btn cap-btn--secondary" data-open-video="' + esc(topic.id) + '" type="button">Reproducir video</button>';
    }
    html += '<button class="cap-btn cap-btn--primary" data-topic-action="next" type="button">Siguiente →</button>';
    el.topicContextActions.innerHTML = html;
    el.topicContextActions.querySelector('[data-topic-action="prev"]').onclick = prev;
    el.topicContextActions.querySelector('[data-topic-action="next"]').onclick = next;
  }

  function renderRegistro() {
    var session = state.data.session || {};
    var course = state.data.course || {};
    el.registroFolio.textContent = session.folio || "—";
    el.registroCourse.textContent = course.name || "—";
    setPill(!!session.registrationOpen);
    if (session.qrUrl) {
      el.qrRegistroImg.src = session.qrUrl;
      el.qrRegistroBox.hidden = false;
      el.qrRegistroPlaceholder.hidden = true;
    } else {
      el.qrRegistroBox.hidden = true;
      el.qrRegistroPlaceholder.hidden = false;
    }
    updateCount();
  }

  function renderEvaluacion() {
    var session = state.data.session || {};
    var evaluation = state.data.evaluation || {};
    if (evaluation.available && session.qrUrl) {
      el.evalQrImg.src = session.qrUrl;
      el.evalQrBox.hidden = false;
      el.evalUnavailable.hidden = true;
    } else {
      el.evalQrBox.hidden = true;
      el.evalUnavailable.hidden = false;
    }
    el.evalTime.textContent = evaluation.duration || "Según cuestionario";
    el.evalMinScore.textContent = evaluation.minScore != null ? evaluation.minScore + "%" : "—";
    el.evalMaxAttempts.textContent = evaluation.maxAttempts != null ? evaluation.maxAttempts : "—";
  }

  function setPill(open) {
    el.registroStatus.textContent = open ? "Registro abierto" : "Registro cerrado";
    el.registroStatus.className = "cap-status-pill " + (open ? "is-open" : "is-closed");
  }

  function updateCount() {
    var session = state.data.session || {};
    el.attendeeTotal.textContent = session.totalRegistered != null ? session.totalRegistered : "—";
    el.attendeeCapacity.textContent = session.capacity != null ? session.capacity : "Sin límite";
    el.attendeeUpdated.textContent = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }

  function refreshCount() {
    el.btnRefreshCount.disabled = true;
    el.btnRefreshCount.textContent = "Actualizando…";
    ICAC_API.getPresentation(state.token).then(function (response) {
      if (response && response.success) {
        state.data.session = Object.assign(state.data.session || {}, response.data.session || {});
        renderRegistro();
        toast("Conteo actualizado");
      }
    }).finally(function () {
      el.btnRefreshCount.disabled = false;
      el.btnRefreshCount.textContent = "Actualizar conteo";
    });
  }

  function openVideo(id) {
    var topic = find(id);
    if (!topic || !topic.embedUrl) return;
    state.currentVideo = topic;
    el.videoModalTitle.textContent = topic.title;
    el.videoModalFrame.src = withAutoplay(topic.embedUrl);
    el.videoModal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeVideo() {
    el.videoModal.hidden = true;
    el.videoModalFrame.src = "";
    state.currentVideo = null;
    document.body.classList.remove("modal-open");
  }

  function restartVideo() {
    if (!state.currentVideo) return;
    el.videoModalFrame.src = "";
    setTimeout(function () {
      el.videoModalFrame.src = withAutoplay(state.currentVideo.embedUrl);
    }, 40);
  }

  function withAutoplay(url) {
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "autoplay=1&rel=0&modestbranding=1";
  }

  function action(name) {
    if (name === "inicio") go(null);
    if (name === "prev") prev();
    if (name === "next") next();
    if (name === "show-registro") go("registro");
    if (name === "show-evaluacion") go("evaluacion");
    if (name === "show-cierre") go("cierre");
    if (name === "fullscreen") toggleFullscreen();
  }

  function keys(event) {
    if (el.presentation.hidden) return;
    if (!el.videoModal.hidden && event.key === "Escape") {
      closeVideo();
      return;
    }
    if (event.key === "ArrowRight") next();
    else if (event.key === "ArrowLeft") prev();
    else if (event.key.toLowerCase() === "f") toggleFullscreen();
    else if (event.key.toLowerCase() === "r") go("registro");
    else if (event.key.toLowerCase() === "e") go("evaluacion");
    else if (event.key === "Home") go(null);
  }

  function firstContent() {
    var topic = state.topics.find(function (item) { return item.kind === "contenido"; });
    if (topic) go(topic.id);
  }

  function next() {
    if (state.currentId === null) {
      firstContent();
      return;
    }
    var current = index(state.currentId);
    if (current >= 0 && current < state.topics.length - 1) go(state.topics[current + 1].id);
  }

  function prev() {
    if (state.currentId === null) return;
    var current = index(state.currentId);
    if (current <= 0) go(null);
    else go(state.topics[current - 1].id);
  }

  function find(id) {
    return state.topics.find(function (topic) { return topic.id === id; });
  }

  function index(id) {
    return state.topics.findIndex(function (topic) { return topic.id === id; });
  }

  function updateNav() {
    document.querySelectorAll(".cap-nav-item").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.topic === state.currentId);
    });
  }

  function updateProgress() {
    var total = state.topics.length;
    var current = state.currentId === null ? 0 : index(state.currentId) + 1;
    el.progressText.textContent = current + " / " + total;
    el.progressBar.style.width = (total ? current / total * 100 : 0) + "%";
  }

  function animateScreen() {
    el.capMain.classList.remove("is-entering");
    void el.capMain.offsetWidth;
    el.capMain.classList.add("is-entering");
    setTimeout(animateCounters, 130);
  }

  function animateCounters() {
    document.querySelectorAll("[data-count]").forEach(function (node) {
      var end = parseInt(node.dataset.count, 10);
      if (!isFinite(end)) return;
      var start = 0;
      var started = performance.now();
      var duration = 700;
      function tick(time) {
        var progress = Math.min(1, (time - started) / duration);
        node.textContent = Math.round(start + (end - start) * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function toggleNav(force) {
    state.navOpen = typeof force === "boolean" ? force : !state.navOpen;
    el.capNav.classList.toggle("is-closed", !state.navOpen);
    document.body.classList.toggle("nav-closed", !state.navOpen);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) exitFullscreen();
    else if (el.presentation.requestFullscreen) el.presentation.requestFullscreen().catch(function () {});
  }

  function exitFullscreen() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
  }

  function fullscreenUi() {
    el.btnExitFullscreen.hidden = !document.fullscreenElement;
  }

  function setStatus(status) {
    state.status = status;
    persistState(state.currentId, status);
  }

  function persistState(id, status) {
    if (state.token) ICAC_API.updatePresentation(state.token, id, status).catch(function () {});
  }

  function toast(message) {
    var toastNode = document.createElement("div");
    toastNode.className = "cap-toast";
    toastNode.textContent = message;
    document.body.appendChild(toastNode);
    setTimeout(function () { toastNode.classList.add("is-visible"); }, 10);
    setTimeout(function () {
      toastNode.classList.remove("is-visible");
      setTimeout(function () { toastNode.remove(); }, 250);
    }, 1800);
  }

  function extractNumber(text) {
    var match = (text || "").match(/\d+/);
    return match ? match[0] : "•";
  }

  function extractSentence(text, pattern) {
    var match = (text || "").match(pattern);
    return match ? match[0] : "";
  }

  function formatDate(value) {
    if (!value) return "Por confirmar";
    var date = new Date(value);
    return isNaN(date) ? "Por confirmar" : date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
})();
