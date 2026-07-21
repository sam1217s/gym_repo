import * as servicioMaquinas from '../servicios/maquinas.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

/** `peticion.filtroSede` lo deja `limitarASede`: `{}` o `{ sede }` segun el rol. */

export const listarMaquinas = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioMaquinas.listarMaquinas(peticion.filtroSede, peticion.query)),
);

export const crearMaquina = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(
    respuesta,
    await servicioMaquinas.crearMaquina(peticion.body, {
      filtroSede: peticion.filtroSede,
      actor: peticion.usuario,
    }),
  ),
);

export const actualizarMaquina = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioMaquinas.actualizarMaquina(
      peticion.params.id,
      peticion.body,
      peticion.filtroSede,
      peticion.usuario,
    ),
  ),
);

export const archivarMaquina = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioMaquinas.archivarMaquina(peticion.params.id, peticion.filtroSede),
  ),
);
