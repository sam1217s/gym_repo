import * as servicioPlanes from '../servicios/planesMembresia.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

export const listarPlanesMembresia = manejadorAsync(async (_peticion, respuesta) =>
  responderOk(respuesta, await servicioPlanes.listarPlanesMembresia()),
);

export const crearPlanMembresia = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(respuesta, await servicioPlanes.crearPlanMembresia(peticion.body)),
);

export const actualizarPlanMembresia = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioPlanes.actualizarPlanMembresia(peticion.params.id, peticion.body),
  ),
);

export const archivarPlanMembresia = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioPlanes.archivarPlanMembresia(peticion.params.id)),
);
