import * as servicioInventario from '../servicios/inventario.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

/** `peticion.filtroSede` lo deja `limitarASede`: `{}` o `{ sede }` segun el rol. */

export const listarInventario = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioInventario.listarInventario(peticion.filtroSede, peticion.query)),
);

export const crearProducto = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(
    respuesta,
    await servicioInventario.crearProducto(peticion.body, { filtroSede: peticion.filtroSede }),
  ),
);

export const actualizarProducto = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioInventario.actualizarProducto(peticion.params.id, peticion.body, peticion.filtroSede),
  ),
);

export const ajustarStock = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioInventario.ajustarStock(peticion.params.id, peticion.body.delta, peticion.filtroSede),
  ),
);

export const archivarProducto = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioInventario.archivarProducto(peticion.params.id, peticion.filtroSede),
  ),
);
