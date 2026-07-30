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
 * El despliegue actual sirve frontend y API bajo el MISMO dominio, asi que se
 * usa `sameSite: 'lax'`: bloquea que otro sitio dispare peticiones autenticadas
 * (defensa CSRF) y evita `'none'`, que exige HTTPS y abre esa superficie. En
 * produccion se anade `secure`. Si algun dia frontend y API viven en dominios
 * distintos, habria que volver a `'none'` + `secure`.
 */
function opcionesCookie(duracionMs, ruta = '/') {
  return {
    httpOnly: true,
    secure: esProduccion,
    sameSite: 'lax',
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

/** El proposito va dentro del token para que no valga como token de acceso. */
const PROPOSITO_VERIFICACION = 'verificacion-email';
const DURACION_TOKEN_VERIFICACION = '2d';

/**
 * Token que viaja en el enlace del correo de verificacion. Se firma con el
 * secreto de acceso pero con un `prop` distinto: aunque alguien lo capture, no
 * sirve como cookie de sesion, y al reves tampoco.
 */
export function firmarTokenVerificacion(usuario) {
  return jwt.sign({ sub: usuario._id.toString(), prop: PROPOSITO_VERIFICACION }, entorno.JWT_SECRETO_ACCESO, {
    expiresIn: DURACION_TOKEN_VERIFICACION,
  });
}

export function verificarTokenVerificacion(token) {
  const carga = jwt.verify(token, entorno.JWT_SECRETO_ACCESO);
  if (carga.prop !== PROPOSITO_VERIFICACION) {
    throw new Error('El token no es de verificacion de correo');
  }
  return carga;
}

const PROPOSITO_PAGO_MIEMBRO = 'pago-miembro';
const DURACION_TOKEN_PAGO_MIEMBRO = '7d';

/**
 * Token del enlace "Pagar ahora" que viaja en el WhatsApp. Identifica al miembro
 * y su gimnasio; NO lleva monto ni plan (se resuelven frescos al abrir el enlace,
 * para no cobrar un precio viejo). Vive 7 dias: el aviso de vencimiento tiene
 * sentido durante esa ventana. `prop` distinto: no sirve como cookie de sesion.
 */
export function firmarTokenPagoMiembro({ miembroId, tenantId }) {
  return jwt.sign(
    { sub: miembroId.toString(), tenant: tenantId.toString(), prop: PROPOSITO_PAGO_MIEMBRO },
    entorno.JWT_SECRETO_ACCESO,
    { expiresIn: DURACION_TOKEN_PAGO_MIEMBRO },
  );
}

export function verificarTokenPagoMiembro(token) {
  const carga = jwt.verify(token, entorno.JWT_SECRETO_ACCESO);
  if (carga.prop !== PROPOSITO_PAGO_MIEMBRO) {
    throw new Error('El token no es de pago de miembro');
  }
  return carga;
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
