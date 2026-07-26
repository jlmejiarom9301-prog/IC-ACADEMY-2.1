/**
 * ICAC - Capa de acceso a las APIs públicas de n8n.
 *
 * Este archivo es el ÚNICO lugar del sitio que hace fetch() hacia el backend.
 * Nunca llama a Airtable directamente: solo a las URLs públicas definidas en
 * config.js (window.ICAC_CONFIG), que a su vez están implementadas como
 * workflows de n8n con su propia validación, control de CORS y auditoría.
 *
 * Contrato de respuesta esperado de ambas APIs (éxito y error):
 *   { success: boolean, code: string, message: string, data: object|null }
 */
(function () {
  "use strict";

  var ICAC_ENV_IS_PROD = window.ICAC_CONFIG && window.ICAC_CONFIG.environment === "production";

  /**
   * Log interno. En "producción" evita imprimir payloads completos a consola
   * (solo mensajes cortos), para no exponer datos capturados por el usuario.
   */
  function debugLog() {
    if (ICAC_ENV_IS_PROD) return;
    if (window.console && window.console.debug) {
      window.console.debug.apply(window.console, arguments);
    }
  }

  /**
   * Normaliza cualquier respuesta de red/parsing en el mismo contrato
   * {success, code, message, data} para que la UI nunca tenga que lidiar
   * con formatos distintos según el tipo de falla.
   */
  function normalizeError(code, message) {
    return { success: false, code: code, message: message, data: null };
  }

  /**
   * Ejecuta un fetch con timeout manual (evita que la página se quede
   * cargando indefinidamente si el backend no responde).
   */
  function fetchWithTimeout(url, options, timeoutMs) {
    var controller = window.AbortController ? new AbortController() : null;
    var opts = Object.assign({}, options || {});
    if (controller) opts.signal = controller.signal;

    var timeoutId = null;
    var timeoutPromise = new Promise(function (_, reject) {
      timeoutId = setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error("timeout"));
      }, timeoutMs || 15000);
    });

    var fetchPromise = fetch(url, opts).finally(function () {
      if (timeoutId) clearTimeout(timeoutId);
    });

    return Promise.race([fetchPromise, timeoutPromise]);
  }

  /**
   * Consulta los datos públicos de una sesión por su token.
   * GET {publicSessionApiUrl}?session=TOKEN
   */
  function getSession(sessionToken) {
    var base = window.ICAC_CONFIG.publicSessionApiUrl;
    var url = base + "?session=" + encodeURIComponent(sessionToken);

    return fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!body || typeof body.success !== "boolean") {
              return normalizeError(
                "INVALID_RESPONSE",
                "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."
              );
            }
            return body;
          });
      })
      .catch(function (err) {
        debugLog("getSession() error:", err && err.message);
        return normalizeError(
          "NETWORK_ERROR",
          "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
        );
      });
  }

  /**
   * Registra a un participante en una sesión.
   * POST {publicRegisterApiUrl}  (application/json)
   */
  function registerParticipant(payload) {
    var url = window.ICAC_CONFIG.publicRegisterApiUrl;

    return fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!body || typeof body.success !== "boolean") {
              return normalizeError(
                "INVALID_RESPONSE",
                "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."
              );
            }
            return body;
          });
      })
      .catch(function (err) {
        debugLog("registerParticipant() error:", err && err.message);
        return normalizeError(
          "NETWORK_ERROR",
          "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
        );
      });
  }

  /**
   * Consulta la disponibilidad de la evaluación asociada a un Token individual.
   * GET {publicEvaluationApiUrl}?token=TOKEN
   */
  function getEvaluation(individualToken) {
    var base = window.ICAC_CONFIG.publicEvaluationApiUrl;
    var url = base + "?token=" + encodeURIComponent(individualToken);

    return fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!body || typeof body.success !== "boolean") {
              return normalizeError(
                "INVALID_RESPONSE",
                "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."
              );
            }
            return body;
          });
      })
      .catch(function (err) {
        debugLog("getEvaluation() error:", err && err.message);
        return normalizeError(
          "NETWORK_ERROR",
          "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
        );
      });
  }

  /**
   * Inicia (o reanuda) un intento de evaluación.
   * POST {startAttemptApiUrl}  (application/json)
   */
  function startAttempt(individualToken) {
    var url = window.ICAC_CONFIG.startAttemptApiUrl;

    return fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: individualToken })
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!body || typeof body.success !== "boolean") {
              return normalizeError(
                "INVALID_RESPONSE",
                "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."
              );
            }
            return body;
          });
      })
      .catch(function (err) {
        debugLog("startAttempt() error:", err && err.message);
        return normalizeError(
          "NETWORK_ERROR",
          "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
        );
      });
  }

  /**
   * Envía y califica las respuestas de un intento de evaluación.
   * POST {submitAnswersApiUrl}  (application/json)
   */
  function submitAnswers(individualToken, resultToken, answers) {
    var url = window.ICAC_CONFIG.submitAnswersApiUrl;

    return fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token: individualToken, resultToken: resultToken, answers: answers })
      },
      25000
    )
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!body || typeof body.success !== "boolean") {
              return normalizeError(
                "INVALID_RESPONSE",
                "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."
              );
            }
            return body;
          });
      })
      .catch(function (err) {
        debugLog("submitAnswers() error:", err && err.message);
        return normalizeError(
          "NETWORK_ERROR",
          "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
        );
      });
  }

  /**
   * Consulta el resultado ya calificado de un intento por su Token de resultado.
   * GET {getResultApiUrl}?token=RESULT_TOKEN
   *
   * Esta es la ÚNICA fuente de verdad para /resultado/: la página nunca debe
   * confiar en calificación/aprobado/elegibilidad recibidos como parámetros
   * de la URL, porque esos valores serían editables a simple vista en el
   * navegador. El backend valida la existencia del token y responde solo con
   * campos seguros (nunca Record IDs, nunca el contenido de las respuestas
   * correctas).
   */
  function getResult(resultToken) {
    var base = window.ICAC_CONFIG.getResultApiUrl;
    var url = base + "?token=" + encodeURIComponent(resultToken);

    return fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!body || typeof body.success !== "boolean") {
              return normalizeError(
                "INVALID_RESPONSE",
                "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."
              );
            }
            return body;
          });
      })
      .catch(function (err) {
        debugLog("getResult() error:", err && err.message);
        return normalizeError(
          "NETWORK_ERROR",
          "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
        );
      });
  }

  /**
   * Consulta el estatus público de un certificado por su Código de validación.
   * GET {publicCertificateApiUrl}?code=CODIGO_VALIDACION
   * Usada por /validar-certificado/. Nunca expone tokens, Record IDs ni
   * información técnica: solo folio, participante, curso, fechas, estatus.
   */
  function getCertificate(validationCode) {
    var base = window.ICAC_CONFIG.publicCertificateApiUrl;
    var url = base + "?code=" + encodeURIComponent(validationCode);

    return fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!body || typeof body.code !== "string") {
              return normalizeError(
                "INVALID_RESPONSE",
                "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."
              );
            }
            return body;
          });
      })
      .catch(function (err) {
        debugLog("getCertificate() error:", err && err.message);
        return normalizeError(
          "NETWORK_ERROR",
          "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
        );
      });
  }

  /**
   * Consulta el/los certificado(s) del participante dueño de un Token
   * individual. GET {certificatesByParticipantApiUrl}?token=TOKEN_INDIVIDUAL
   * Usada por /certificados/. Nunca expone tokens de descarga crudos fuera
   * de la URL de descarga ya construida por el backend.
   */
  function getCertificatesByParticipant(individualToken) {
    var base = window.ICAC_CONFIG.certificatesByParticipantApiUrl;
    var url = base + "?token=" + encodeURIComponent(individualToken);

    return fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!body || typeof body.success !== "boolean") {
              return normalizeError(
                "INVALID_RESPONSE",
                "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."
              );
            }
            return body;
          });
      })
      .catch(function (err) {
        debugLog("getCertificatesByParticipant() error:", err && err.message);
        return normalizeError(
          "NETWORK_ERROR",
          "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
        );
      });
  }

  /**
   * Construye la URL de descarga directa de un certificado a partir de su
   * Token de descarga. Se usa como href de un <a> (nunca con fetch()): el
   * navegador maneja la descarga binaria mediante el header
   * Content-Disposition que ya envía el backend.
   */
  function buildCertificateDownloadUrl(downloadToken) {
    var base = window.ICAC_CONFIG.certificateDownloadApiUrl;
    return base + "?token=" + encodeURIComponent(downloadToken);
  }

  /**
   * Consulta los datos de presentación de una sesión por su Token de
   * presentación. GET {publicPresentationApiUrl}?session=TOKEN_PRESENTACION
   * Usada exclusivamente por /capacitador/ (modo presentación presencial).
   */
  function getPresentation(presentationToken) {
    var base = window.ICAC_CONFIG.publicPresentationApiUrl;
    var url = base + "?session=" + encodeURIComponent(presentationToken);

    return fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!body || typeof body.success !== "boolean") {
              return normalizeError(
                "INVALID_RESPONSE",
                "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."
              );
            }
            return body;
          });
      })
      .catch(function (err) {
        debugLog("getPresentation() error:", err && err.message);
        return normalizeError(
          "NETWORK_ERROR",
          "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
        );
      });
  }

  /**
   * Persiste el tema actual y/o el estatus de la presentación para que el
   * capacitador pueda recargar la página sin perder el avance. No guarda
   * progreso académico ni datos de colaboradores.
   * POST {updatePresentationApiUrl}  (application/json)
   */
  function updatePresentation(presentationToken, currentTopic, status) {
    var url = window.ICAC_CONFIG.updatePresentationApiUrl;
    var payload = { session: presentationToken };
    if (currentTopic !== undefined && currentTopic !== null) payload.currentTopic = currentTopic;
    if (status !== undefined && status !== null) payload.status = status;

    return fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!body || typeof body.success !== "boolean") {
              return normalizeError(
                "INVALID_RESPONSE",
                "No pudimos leer la respuesta del servidor. Intenta de nuevo más tarde."
              );
            }
            return body;
          });
      })
      .catch(function (err) {
        debugLog("updatePresentation() error:", err && err.message);
        return normalizeError(
          "NETWORK_ERROR",
          "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
        );
      });
  }

  window.ICAC_API = {
    getSession: getSession,
    registerParticipant: registerParticipant,
    getEvaluation: getEvaluation,
    startAttempt: startAttempt,
    submitAnswers: submitAnswers,
    getResult: getResult,
    getCertificate: getCertificate,
    getCertificatesByParticipant: getCertificatesByParticipant,
    buildCertificateDownloadUrl: buildCertificateDownloadUrl,
    getPresentation: getPresentation,
    updatePresentation: updatePresentation
  };
})();
