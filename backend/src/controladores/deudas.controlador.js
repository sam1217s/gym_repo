import * as servicioDeudas from '../servicios/deudas.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

/** Deudas del gimnasio. La ruta las restringe al dueño. */

export const listarDeudas = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioDeudas.listarDeudas(peticion.filtroSede)),
);

export const crearDeuda = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(
    respuesta,
    await servicioDeudas.crearDeuda(peticion.body, { filtroSede: peticion.filtroSede }),
  ),
);

export const actualizarDeuda = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioDeudas.actualizarDeuda(peticion.params.id, peticion.body, peticion.filtroSede),
  ),
);

export const archivarDeuda = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioDeudas.archivarDeuda(peticion.params.id, peticion.filtroSede)),
);

export const abonarDeuda = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(
    respuesta,
    await servicioDeudas.abonarDeuda(peticion.params.id, peticion.body, peticion.filtroSede),
  ),
);
