import { entorno } from '../config/entorno.js';
import * as servicioMensajes from '../servicios/mensajes.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

/** `peticion.filtroSede` lo deja `limitarASede`: `{}` o `{ sede }` segun el rol. */

export const listarMensajes = manejadorAsync(async (peticion, respuesta) => {
  const [mensajes, pendientes] = await Promise.all([
    servicioMensajes.listarMensajes(peticion.filtroSede, peticion.query),
    servicioMensajes.contarPendientes(peticion.filtroSede),
  ]);
  return responderOk(respuesta, { mensajes, pendientes });
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

/**
 * Sirve el comprobante. Los de Cloudinary se sirven redirigiendo a una URL
 * firmada de corta duracion; los HEREDADOS (disco) se streamean con permisos.
 * En ningun caso se expone el almacen.
 */
export const descargarArchivo = manejadorAsync(async (peticion, respuesta) => {
  const { redireccion, ruta, mimeType } = await servicioMensajes.rutaArchivo(
    peticion.params.id,
    peticion.filtroSede,
  );
  if (redireccion) return respuesta.redirect(redireccion);
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
