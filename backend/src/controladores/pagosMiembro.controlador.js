import { aplicarEventoPagoMiembro, construirCheckoutDesdeToken } from '../servicios/pagosMiembro.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderOk } from '../utilidades/respuesta.js';

/**
 * Pago en linea de un miembro. Dos rutas PUBLICAS (sin cookie ni sesion):
 * quien llega es el celular del miembro desde el boton de WhatsApp, o la propia
 * pasarela con el webhook.
 */

/** Pagina minima a la que Wompi devuelve al miembro tras el checkout. */
function paginaSimple(titulo, detalle) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f2f4f7;color:#1b1e24}
.tarjeta{background:#fff;max-width:420px;padding:2rem;border-radius:12px;border-top:4px solid #c1272d;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1{margin:.2rem 0 1rem;text-transform:uppercase;letter-spacing:.03em}</style></head>
<body><div class="tarjeta"><h1>${titulo}</h1><p>${detalle}</p></div></body></html>`;
}

/**
 * GET /api/pagar/:token — el boton "Pagar ahora" del WhatsApp.
 * Arma el checkout de Wompi del gimnasio y redirige (302) al miembro.
 * Si el enlace no vale, se muestra una pagina amable (no un JSON): quien lo abre
 * es un cliente, no un desarrollador.
 */
export const redirigirAPago = manejadorAsync(async (peticion, respuesta) => {
  try {
    const urlCheckout = await construirCheckoutDesdeToken(peticion.params.token);
    return respuesta.redirect(302, urlCheckout);
  } catch (error) {
    const detalle = error.esOperacional
      ? error.message
      : 'No pudimos abrir el pago. Pide a tu gimnasio un enlace nuevo.';
    return respuesta.status(400).type('html').send(paginaSimple('Enlace no disponible', detalle));
  }
});

/** GET /api/pagar/gracias — aterrizaje tras pagar en Wompi. */
export const paginaGracias = (_peticion, respuesta) => {
  return respuesta
    .type('html')
    .send(paginaSimple('¡Gracias!', 'Estamos confirmando tu pago. Tu mensualidad se renovara en cuanto Wompi lo apruebe.'));
};

/**
 * POST /api/webhooks/wompi-miembro — la pasarela confirma el pago.
 * La firma se verifica DENTRO del servicio (con el secreto del gimnasio). A un
 * evento verificado se le responde 200 aunque se ignore: un error hace que
 * Wompi lo reintente en bucle.
 */
export const recibirEventoWompiMiembro = manejadorAsync(async (peticion, respuesta) => {
  const resultado = await aplicarEventoPagoMiembro(peticion.body);
  return responderOk(respuesta, resultado);
});
