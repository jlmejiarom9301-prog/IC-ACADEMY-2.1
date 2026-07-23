# IC Academy &mdash; Registro público de participantes (GitHub Pages)

Sitio estático que permite a un colaborador registrarse a una sesión de
capacitación escaneando el código QR generado por el workflow
**ICAC - Sesiones - Generar acceso y QR**. El sitio **no habla directamente
con Airtable**: todas las lecturas y escrituras pasan por dos APIs públicas
implementadas en n8n.

```
GitHub Pages  →  API pública n8n (GET/POST)  →  Airtable
```

## Estructura de archivos

```
ic-academy-registro-publico/
├── index.html                 Landing: explica el flujo por QR y permite pegar un código manualmente
├── registro/
│   └── index.html              Página funcional de registro (?session=TOKEN)
├── assets/
│   ├── css/
│   │   └── styles.css          Hoja de estilos única, mobile-first, sin frameworks
│   ├── js/
│   │   ├── config.js           URLs públicas de las APIs y datos no sensibles
│   │   ├── api.js               Única capa que hace fetch() hacia n8n
│   │   └── registro.js          Lógica de la página /registro/ (estados, formulario, validación)
│   └── img/                     Vacío por ahora (logotipo/QR van en Airtable, no aquí)
└── README.md
```

## APIs públicas que consume este sitio

| API | Método | Workflow n8n | Uso |
|---|---|---|---|
| Consultar sesión | `GET` | `ICAC - API - Consultar sesión pública - v1` | Carga los datos públicos de la sesión al entrar a `/registro/?session=TOKEN` |
| Registrar participante | `POST` | `ICAC - Registro - Procesar participante - v1` | Envía el formulario de registro |

Las URLs exactas están en `assets/js/config.js`. **No existen credenciales,
API keys de Airtable, ni Record IDs en ningún archivo de este sitio.**

## Antes de publicar: activar los workflows en n8n

Por diseño, mientras se construyó y probó este módulo **ambos workflows se
dejaron desactivados** (`active: false`) en n8n, para no exponer un endpoint
público sin validar. Las URLs de producción en `config.js` **no responderán**
hasta que actives manualmente ambos workflows desde n8n:

1. Entra a n8n → abre `ICAC - API - Consultar sesión pública - v1` → actívalo.
2. Entra a n8n → abre `ICAC - Registro - Procesar participante - v1` → actívalo.
3. Verifica que ambos webhooks respondan (una consulta `GET` de prueba con un
   token de una sesión de prueba es suficiente).

## Pasos manuales para publicar en GitHub Pages

1. Crea un repositorio dedicado exclusivamente a este sitio (independiente de
   cualquier repositorio de CRM/ventas), por ejemplo `ic-academy` para
   producción o `ic-academy-pruebas` para el ambiente de pruebas.
2. Copia el contenido de esta carpeta (`ic-academy-registro-publico/`) a la
   raíz del repositorio (o a `/docs` si prefieres esa convención).
3. Sube los archivos a la rama que uses para Pages (normalmente `main`).
4. En GitHub: **Settings → Pages → Build and deployment → Source**, selecciona
   `Deploy from a branch` y la rama/carpeta correspondiente.
5. Espera a que GitHub Pages publique el sitio y confirma la URL asignada
   (por ejemplo `https://icacademy-demo.github.io/` o
   `https://icacademy-demo.github.io/ic-academy-pruebas/`).
6. Si la URL final del sitio publicado es distinta a
   `https://icacademy-demo.github.io` o
   `https://icacademy-demo.github.io/ic-academy-pruebas`, actualiza:
   - El parámetro `allowedOrigins` del nodo Webhook en **ambos** workflows de n8n.
   - La clave `cors_origenes_permitidos_registro_publico` en la tabla
     `Configuración` de Airtable (documental).
7. Prueba el flujo completo en el sitio ya publicado: escanea un QR real de
   una sesión de prueba (`Registro de prueba = Sí`) y completa un registro.

## Notas de seguridad ya aplicadas

- `config.js` solo contiene URLs públicas, el nombre de la plataforma y la
  liga al aviso de privacidad. No hay tokens, API keys ni Record IDs.
- `api.js` es el único archivo que hace `fetch()`; nunca se llama a la API
  de Airtable desde el navegador.
- `registro.js` nunca usa `innerHTML` con datos provenientes de la API
  (siempre `textContent`), para evitar inyección de HTML/script.
- No se usa `localStorage` ni `sessionStorage` para datos personales ni para
  el token individual de participante.
- El formulario no solicita contraseña, CURP, RFC, datos bancarios,
  domicilio ni información médica.
- La validación del formulario en el navegador es solo para UX: la API
  vuelve a validar todo del lado del servidor (token de sesión, campos
  obligatorios, formato de correo, aceptación de privacidad, etc.).
- Los enlaces externos (aviso de privacidad, liga virtual) usan
  `rel="noopener noreferrer"`.

## Pendiente fuera de este alcance

Este módulo entrega **únicamente el registro público a una sesión**. A
propósito **no incluye**:

- Presentación o resolución de evaluaciones.
- Descarga o visualización de certificados.

El *Token individual* que la API de registro genera para cada participante
queda guardado en Airtable (tabla `Registros de sesión`) y está pensado para
usarse más adelante como llave de acceso a esas dos funcionalidades, cuando
se construyan en una siguiente fase.
