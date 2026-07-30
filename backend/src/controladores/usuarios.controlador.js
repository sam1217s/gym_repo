import * as servicioUsuarios from '../servicios/usuarios.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

export const listarUsuarios = manejadorAsync(async (_peticion, respuesta) =>
  responderOk(respuesta, await servicioUsuarios.listarUsuarios()),
);

export const crearUsuario = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(respuesta, await servicioUsuarios.crearUsuario(peticion.body)),
);

export const actualizarUsuario = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioUsuarios.actualizarUsuario(peticion.params.id, peticion.body),
  ),
);

export const eliminarUsuario = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioUsuarios.eliminarUsuario(peticion.params.id)),
);
