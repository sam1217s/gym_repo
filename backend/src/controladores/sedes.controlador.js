import * as servicioSedes from '../servicios/sedes.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

export const listarSedes = manejadorAsync(async (_peticion, respuesta) =>
  responderOk(respuesta, await servicioSedes.listarSedes()),
);

export const crearSede = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(respuesta, await servicioSedes.crearSede(peticion.body)),
);

export const actualizarSede = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioSedes.actualizarSede(peticion.params.id, peticion.body)),
);
