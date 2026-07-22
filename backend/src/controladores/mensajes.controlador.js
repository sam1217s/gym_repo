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

/** Sirve el comprobante. No se expone el almacen: se streamea con permisos. */
export const descargarArchivo = manejadorAsync(async (peticion, respuesta) => {
  const { ruta, mimeType } = await servicioMensajes.rutaArchivo(
    peticion.params.id,
    peticion.filtroSede,
  );
  respuesta.type(mimeType);
  return respuesta.sendFile(ruta);
});

// --- Webhook de Meta (publico) -------------------------------------------------

export const verificarWebhook = manejadorAsync(async (peticion, respuesta) => {
  const desafio = servicioMensajes.verificarSuscripcion({
    modo: peticion.query['hub.mode'],
    token: peticion.query['hub.verify_token'],
    desafio: peticion.query['hub.challenge'],
  });
  return respuesta.status(200).send(desafio);
});

/**
 * A Meta se le responde 200 SIEMPRE que la firma sea valida, incluso si el
 * evento se ignora: cualquier otra cosa lo hace reintentar en bucle.
 */
export const recibirWebhook = manejadorAsync(async (peticion, respuesta) => {
  await servicioMensajes.procesarEventoEntrante({
    cuerpo: peticion.body,
    cuerpoCrudo: peticion.cuerpoCrudo,
    firma: peticion.get('x-hub-signature-256'),
  });
  return respuesta.sendStatus(200);
});
