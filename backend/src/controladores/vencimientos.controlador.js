import * as servicioVencimientos from '../servicios/vencimientos.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderOk } from '../utilidades/respuesta.js';

export const listarVencimientos = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioVencimientos.listarVencimientos(peticion.filtroSede)),
);
