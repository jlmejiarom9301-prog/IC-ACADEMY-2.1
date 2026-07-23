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

  // Detecta si el sitio se sirve desde el proyecto de pruebas
  // (https://icacademy-demo.github.io/ic-academy-pruebas) o desde producción
  // (https://icacademy-demo.github.io). Es solo informativo: hoy ambos ambientes
  // usan las mismas APIs públicas de n8n, diferenciadas internamente por la
  // bandera "modo_prueba" y el campo "Registro de prueba" en Airtable.
  var isTestSite =
    window.location.hostname === "icacademy-demo.github.io" &&
    window.location.pathname.indexOf("/ic-academy-pruebas") === 0;

  window.ICAC_CONFIG = {
    // Ambiente detectado (solo informativo/depuración, no cambia el comportamiento de la API)
    environment: isTestSite ? "test" : "production",

    // Nombre visible de la plataforma
    platformName: "IC Academy",

    // API pública GET: consulta los datos públicos de una sesión por su token
    publicSessionApiUrl:
      "https://jmejiaromero.app.n8n.cloud/webhook/icac/public/session",

    // API pública POST: registra a un participante en una sesión
    publicRegisterApiUrl:
      "https://jmejiaromero.app.n8n.cloud/webhook/icac/public/register",

    // Liga al aviso de privacidad mostrado en el formulario de registro.
    // TODO: reemplazar por la URL real del aviso de privacidad de IC Academy.
    privacyNoticeUrl: "https://www.icacademy-demo.example.com/aviso-de-privacidad"
  };
})();
