import jwt from 'jsonwebtoken';
import {
  COOKIE_ACCESO,
  COOKIE_REFRESCO,
  DURACION_TOKEN_ACCESO,
  DURACION_TOKEN_ACCESO_MS,
  DURACION_TOKEN_REFRESCO,
  DURACION_TOKEN_REFRESCO_MS,
  RUTA_COOKIE_REFRESCO,
} from '../config/constantes.js';
import { entorno, esProduccion } from '../config/entorno.js';

/**
 * Tokens JWT y las cookies HttpOnly que los transportan.
 *
 * El token NUNCA llega a JavaScript del navegador: va en cookie `httpOnly`, lo
 * que lo hace inmune a XSS. A cambio hay que protegerse de CSRF, y de eso se
 * encarga `sameSite`.
 */

/**
 * Opciones base de cookie.
 *
 * En desarrollo el proxy de Quasar hace que el frontend y la API compartan
 * origen (`localhost:9000`), asi que `sameSite: 'lax'` basta y no hace falta
 * `secure`.
 *
 * En produccion se asume que el frontend vive en un dominio distinto al de la
 * API, lo que obliga a `sameSite: 'none'` + `secure: true` (el navegador
 * rechaza `none` sin HTTPS). Si despliegas ambos bajo el mismo dominio, baja
 * esto a `'lax'`: es mas seguro.
 */
function opcionesCookie(duracionMs, ruta = '/') {
  return {
    httpOnly: true,
    secure: esProduccion,
    sameSite: esProduccion ? 'none' : 'lax',
    maxAge: duracionMs,
    path: ruta,
  };
}

export function firmarTokenAcceso(usuario) {
  const carga = {
    sub: usuario._id.toString(),
    rol: usuario.rol,
    tenant: usuario.tenant ? usuario.tenant.toString() : null,
    sede: usuario.sede ? usuario.sede.toString() : null,
    version: usuario.versionToken,
  };

  return jwt.sign(carga, entorno.JWT_SECRETO_ACCESO, { expiresIn: DURACION_TOKEN_ACCESO });
}

export function firmarTokenRefresco(usuario) {
  const carga = { sub: usuario._id.toString(), version: usuario.versionToken };
  return jwt.sign(carga, entorno.JWT_SECRETO_REFRESCO, { expiresIn: DURACION_TOKEN_REFRESCO });
}

export function verificarTokenAcceso(token) {
  return jwt.verify(token, entorno.JWT_SECRETO_ACCESO);
}

export function verificarTokenRefresco(token) {
  return jwt.verify(token, entorno.JWT_SECRETO_REFRESCO);
}

/**
 * El refresh token se limita a `path=/api/auth/refrescar`: el navegador no lo
 * adjunta al resto de la API, asi que una vulnerabilidad en otro endpoint no lo
 * expone.
 */
export function establecerCookiesSesion(respuesta, usuario) {
  respuesta.cookie(COOKIE_ACCESO, firmarTokenAcceso(usuario), opcionesCookie(DURACION_TOKEN_ACCESO_MS));
  respuesta.cookie(
    COOKIE_REFRESCO,
    firmarTokenRefresco(usuario),
    opcionesCookie(DURACION_TOKEN_REFRESCO_MS, RUTA_COOKIE_REFRESCO),
  );
}

export function limpiarCookiesSesion(respuesta) {
  respuesta.clearCookie(COOKIE_ACCESO, { ...opcionesCookie(0), maxAge: undefined });
  respuesta.clearCookie(COOKIE_REFRESCO, {
    ...opcionesCookie(0, RUTA_COOKIE_REFRESCO),
    maxAge: undefined,
  });
}
