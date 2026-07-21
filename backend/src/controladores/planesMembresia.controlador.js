import * as servicioPlanes from '../servicios/planesMembresia.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

/** `peticion.filtroSede` lo deja `limitarASede`: `{}` o `{ sede }` segun el rol. */

export const listarPlanesMembresia = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioPlanes.listarPlanesMembresia(peticion.filtroSede, peticion.query),
  ),
);

export const crearPlanMembresia = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(
    respuesta,
    await servicioPlanes.crearPlanMembresia(peticion.body, { filtroSede: peticion.filtroSede }),
  ),
);

export const actualizarPlanMembresia = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioPlanes.actualizarPlanMembresia(
      peticion.params.id,
      peticion.body,
      peticion.filtroSede,
    ),
  ),
);

export const archivarPlanMembresia = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioPlanes.archivarPlanMembresia(peticion.params.id, peticion.filtroSede),
  ),
);
