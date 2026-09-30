import { entorno } from '../config/entorno.js';
import * as servicioMensajes from '../servicios/mensajes.servicio.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

/** `peticion.filtroSede` lo deja `limitarASede`: `{}` o `{ sede }` segun el rol. */

export const listarMensajes = manejadorAsync(async (peticion, respuesta) => {
  const [mensajes, pendientes, comprobantesPendientes] = await Promise.all([
    servicioMensajes.listarMensajes(peticion.filtroSede, peticion.query),
    servicioMensajes.contarPendientes(peticion.filtroSede),
    servicioMensajes.comprobantesPendientes(peticion.filtroSede),
  ]);
  return responderOk(respuesta, { mensajes, pendientes, comprobantesPendientes });
});

export const contarPendientes = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, { pendientes: await servicioMensajes.contarPendientes(peticion.filtroSede) }),
);

export const marcarLeidos = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioMensajes.marcarLeidos(peticion.body?.ids, peticion.filtroSede)),
);

export const responder = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(
    respuesta,
    await servicioMensajes.responder(peticion.body, peticion.filtroSede, peticion.usuario._id),
  ),
);

const TIEMPO_LIMITE_DESCARGA_MS = 15_000;

/**
 * Sirve el comprobante SIEMPRE desde nuestro propio origen. Los de Cloudinary se
 * bajan en el servidor (con la URL firmada) y se reenvian al navegador; los
 * HEREDADOS (disco) se streamean. NO se redirige a Cloudinary: el frontend baja
 * el archivo por Axios (con cookie, para heredar el auto-refresco del token), y
 * un redirect cross-origin con credenciales lo bloquea CORS. En ningun caso se
 * expone el almacen ni la URL firmada al cliente.
 */
export const descargarArchivo = manejadorAsync(async (peticion, respuesta) => {
  const { redireccion, ruta, mimeType } = await servicioMensajes.rutaArchivo(
    peticion.params.id,
    peticion.filtroSede,
  );

  if (redireccion) {
    const arriba = await fetch(redireccion, { signal: AbortSignal.timeout(TIEMPO_LIMITE_DESCARGA_MS) });
    if (!arriba.ok) throw ErrorApi.noEncontrado('No se pudo obtener el archivo');
    const tipo = arriba.headers.get('content-type') || mimeType || 'application/octet-stream';
    const buffer = Buffer.from(await arriba.arrayBuffer());
    respuesta.type(tipo);
    return respuesta.send(buffer);
  }

  respuesta.type(mimeType);
  return respuesta.sendFile(ruta);
});

// --- Webhook de Twilio (publico) -----------------------------------------------

/**
 * A Twilio se le responde 200 salvo firma invalida, incluso si el evento se
 * ignora: cualquier otra cosa lo hace reintentar en bucle. La URL publica se
 * reconstruye EXACTA (la que Twilio invoco) para poder verificar la firma.
 *
 * Se responde TwiML VACIO (`<Response></Response>`), no `sendStatus(200)`: el
 * webhook de mensajeria de Twilio interpreta el cuerpo de la respuesta como la
 * contestacion al miembro, y `sendStatus(200)` manda el texto "OK", que llegaba
 * al miembro como un auto-reply. Un TwiML vacio le dice a Twilio que no conteste.
 */
export const recibirWebhook = manejadorAsync(async (peticion, respuesta) => {
  await servicioMensajes.procesarEventoEntrante({
    params: peticion.body,
    urlPublica: `${entorno.ORIGEN_PUBLICO}${peticion.originalUrl}`,
    firma: peticion.get('x-twilio-signature'),
  });
  return respuesta.type('text/xml').send('<Response></Response>');
});
