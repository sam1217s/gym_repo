import * as servicioGastos from '../servicios/gastos.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

/** `peticion.filtroSede` lo deja `limitarASede`: `{}` o `{ sede }` segun el rol. */

export const listarGastos = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioGastos.listarGastos(peticion.filtroSede, peticion.query)),
);

export const resumenFinanzas = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioGastos.resumenFinanzas(peticion.filtroSede, peticion.query)),
);

export const crearGasto = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(
    respuesta,
    await servicioGastos.crearGasto(peticion.body, { filtroSede: peticion.filtroSede }),
  ),
);

export const actualizarGasto = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioGastos.actualizarGasto(peticion.params.id, peticion.body, peticion.filtroSede),
  ),
);

export const eliminarGasto = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioGastos.eliminarGasto(peticion.params.id, peticion.filtroSede)),
);
