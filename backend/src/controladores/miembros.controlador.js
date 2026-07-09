import * as servicioMiembros from '../servicios/miembros.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

/** `peticion.filtroSede` lo deja `limitarASede`: `{}` o `{ sede }` segun el rol. */

export const listarMiembros = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioMiembros.listarMiembros(peticion.filtroSede, peticion.query)),
);

export const crearMiembro = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(
    respuesta,
    await servicioMiembros.crearMiembro(peticion.body, { filtroSede: peticion.filtroSede }),
  ),
);

export const actualizarMiembro = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioMiembros.actualizarMiembro(peticion.params.id, peticion.body, peticion.filtroSede),
  ),
);
