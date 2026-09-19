import { COOKIE_REFRESCO } from '../config/constantes.js';
import * as servicioAuth from '../servicios/auth.servicio.js';
import * as servicioOtp from '../servicios/otp.servicio.js';
import * as servicioUsuarios from '../servicios/usuarios.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderOk } from '../utilidades/respuesta.js';
import { establecerCookiesSesion, limpiarCookiesSesion } from '../utilidades/token.js';

/**
 * Capa HTTP. Lee la peticion, delega en el servicio, escribe la respuesta.
 * Cero logica de negocio: si aqui aparece un `if` sobre reglas del dominio,
 * pertenece a `servicios/`.
 */

export const iniciarSesion = manejadorAsync(async (peticion, respuesta) => {
  const { usuario, tenant } = await servicioAuth.iniciarSesion(peticion.body);

  establecerCookiesSesion(respuesta, usuario);
  return responderOk(respuesta, servicioAuth.describirSesion(usuario, tenant));
});

export const cerrarSesion = manejadorAsync(async (peticion, respuesta) => {
  await servicioAuth.cerrarSesion(peticion.usuario._id);

  limpiarCookiesSesion(respuesta);
  return responderOk(respuesta, { mensaje: 'Sesion cerrada' });
});

export const refrescar = manejadorAsync(async (peticion, respuesta) => {
  const { usuario, tenant } = await servicioAuth.refrescarSesion(peticion.cookies?.[COOKIE_REFRESCO]);

  establecerCookiesSesion(respuesta, usuario);
  return responderOk(respuesta, servicioAuth.describirSesion(usuario, tenant));
});

export const cambiarContrasena = manejadorAsync(async (peticion, respuesta) => {
  const usuario = await servicioAuth.cambiarContrasena(peticion.usuario._id, peticion.body);

  // Cambiar la contrasena sube `versionToken` e invalida las cookies actuales,
  // incluidas las de este navegador. Se reemiten para no expulsar a quien acaba
  // de cambiarla.
  establecerCookiesSesion(respuesta, usuario);
  return responderOk(respuesta, servicioAuth.describirSesion(usuario, peticion.tenant));
});

export const obtenerSesion = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, servicioAuth.describirSesion(peticion.usuario, peticion.tenant)),
);

// --- Login por telefono con codigo (OTP) --------------------------------------

/** Dispara el envio del codigo. Respuesta generica (no revela si el numero existe). */
export const enviarOtp = manejadorAsync(async (peticion, respuesta) => {
  await servicioOtp.enviarCodigoOtp(peticion.body);
  return responderOk(respuesta, {
    mensaje: 'Si el numero corresponde a un usuario, enviamos un codigo.',
  });
});

/** Comprueba el codigo y, si es valido, abre sesion como el login normal. */
export const verificarOtp = manejadorAsync(async (peticion, respuesta) => {
  const { usuario, tenant } = await servicioOtp.verificarCodigoOtp(peticion.body);

  establecerCookiesSesion(respuesta, usuario);
  return responderOk(respuesta, servicioAuth.describirSesion(usuario, tenant));
});

/** El usuario en sesion fija su propio telefono (para poder entrar por OTP). */
export const actualizarMiTelefono = manejadorAsync(async (peticion, respuesta) => {
  const usuario = await servicioUsuarios.actualizarMiTelefono(peticion.usuario._id, peticion.body.telefono);
  return responderOk(respuesta, servicioAuth.describirSesion(usuario, peticion.tenant));
});
