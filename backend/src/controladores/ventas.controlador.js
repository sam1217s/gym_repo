import * as servicioVentas from '../servicios/ventas.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

/** `peticion.filtroSede` lo deja `limitarASede`: `{}` o `{ sede }` segun el rol. */

export const registrarVenta = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(respuesta, await servicioVentas.registrarVenta(peticion.body, peticion.filtroSede)),
);

export const listarVentas = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioVentas.listarVentas(peticion.filtroSede, peticion.query)),
);
