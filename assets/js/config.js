/**
 * ICAC - Configuración pública del sitio de registro (GitHub Pages)
 *
 * QUÉ SÍ VA AQUÍ:
 *   - URLs públicas de las APIs de n8n (webhooks públicos de solo consulta/registro)
 *   - Nombre de la plataforma y liga al aviso de privacidad
 *   - Bandera de ambiente (solo informativa, para mensajes de depuración)
 *
 * QUÉ NUNCA DEBE IR AQUÍ (ni en ningún otro archivo de este sitio):
 *   - API keys o tokens personales de Airtable
 *   - Credenciales o tokens de n8n
 *   - Record IDs internos de Airtable
 *   - Respuestas correctas de evaluaciones
 *   - Cualquier dato privado de participantes
 *
 * Este sitio SIEMPRE habla con Airtable a través de las APIs públicas de n8n.
 * Nunca debe agregarse aquí una API key de Airtable ni conectarse directamente
 * a la API de Airtable desde el navegador.
 */
(function () {
  "use strict";

  // Sitio real: https://jlmejiarom9301-prog.github.io/IC-ACADEMY-2.1/
  // "localhost"/127.0.0.1 se trata como ambiente de prueba local; cualquier
  // otro host (incluido el sitio real) se trata como producción. Es solo
  // informativo: no cambia el comportamiento de la API, que siempre se
  // diferencia internamente por la bandera "modo_prueba" y el campo
  // "Registro de prueba" en Airtable.
  var isLocalTestSite =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  // IMPORTANTE: las URLs de los webhooks de n8n de este proyecto NO llevan el
  // UUID del webhook en la ruta (a diferencia de lo que muestra la ficha del
  // trigger en el editor de n8n). Se verificó con solicitudes HTTP reales
  // desde el sitio publicado en jlmejiarom9301-prog.github.io/IC-ACADEMY-2.1
  // que la URL CON UUID falla (CORS/ruteo) y la URL SIN UUID responde 200
  // con el cuerpo esperado. No agregar el UUID de vuelta sin volver a probar.
  window.ICAC_CONFIG = {
    // Ambiente detectado (solo informativo/depuración, no cambia el comportamiento de la API)
    environment: isLocalTestSite ? "test" : "production",

    // Nombre visible de la plataforma
    platformName: "IC Academy",

    // API pública GET: consulta los datos públicos de una sesión por su token
    publicSessionApiUrl:
      "https://jmejiaromero.app.n8n.cloud/webhook/icac/public/session",

    // API pública POST: registra a un participante en una sesión
    publicRegisterApiUrl:
      "https://jmejiaromero.app.n8n.cloud/webhook/icac/public/register",

    // API pública GET: consulta la disponibilidad de la evaluación de un participante por su Token individual
    publicEvaluationApiUrl:
      "https://jmejiaromero.app.n8n.cloud/webhook/icac/public/evaluation",

    // API pública POST: inicia (o reanuda) un intento de evaluación
    startAttemptApiUrl:
      "https://jmejiaromero.app.n8n.cloud/webhook/icac/public/evaluation/start",

    // API pública POST: envía y califica las respuestas de un intento de evaluación
    submitAnswersApiUrl:
      "https://jmejiaromero.app.n8n.cloud/webhook/icac/public/evaluation/submit",

    // API pública GET: consulta el resultado ya calificado por su Token de resultado
    // (usada por /resultado/ en vez de confiar en parámetros de la URL)
    getResultApiUrl:
      "https://jmejiaromero.app.n8n.cloud/webhook/icac/public/evaluation/result",

    // Liga al aviso de privacidad mostrado en el formulario de registro.
    // TODO: reemplazar por la URL real del aviso de privacidad de IC Academy.
    privacyNoticeUrl: "https://www.icacademy-demo.example.com/aviso-de-privacidad"
  };
})();
