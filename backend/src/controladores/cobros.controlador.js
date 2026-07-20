import { guardarConfigCobros, obtenerConfigCobros } from '../servicios/cobros.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderOk } from '../utilidades/respuesta.js';

/** Config del cobro en linea a miembros (llaves Wompi del dueno). Solo el dueno. */

export const verConfig = manejadorAsync(async (_peticion, respuesta) => {
  return responderOk(respuesta, await obtenerConfigCobros());
});

export const guardarConfig = manejadorAsync(async (peticion, respuesta) => {
  return responderOk(respuesta, await guardarConfigCobros(peticion.body));
});
