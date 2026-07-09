import * as servicioPagos from '../servicios/pagos.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

export const listarPagos = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioPagos.listarPagos(peticion.filtroSede, peticion.query)),
);

export const registrarPago = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(respuesta, await servicioPagos.registrarPago(peticion.body, peticion.filtroSede)),
);
