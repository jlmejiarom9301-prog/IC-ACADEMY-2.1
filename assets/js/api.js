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

  window.ICAC_API = {
    getSession: getSession,
    registerParticipant: registerParticipant
  };
})();
