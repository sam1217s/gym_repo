import { ROLES } from '../config/constantes.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Autorizacion por rol. El aislamiento por tenant ya lo garantiza el plugin de
 * Mongoose; aqui solo se decide QUE puede hacer cada rol dentro de su ambito.
 */
export function requiereRol(...rolesPermitidos) {
  return function verificarRol(peticion, _respuesta, siguiente) {
    if (!peticion.usuario) return siguiente(ErrorApi.noAutenticado());

    if (!rolesPermitidos.includes(peticion.usuario.rol)) {
      return siguiente(ErrorApi.prohibido('Tu rol no permite esta operacion'));
    }
    return siguiente();
  };
}

export const requiereSuperAdmin = requiereRol(ROLES.SUPER_ADMIN);
export const requiereDuenoGimnasio = requiereRol(ROLES.TENANT_OWNER);
export const requierePersonalGimnasio = requiereRol(ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN);

/**
 * Un `sede_admin` solo ve su sede. Deja en `peticion.filtroSede` el filtro que
 * los servicios deben aplicar: `{}` para quien ve todas las sedes del gimnasio,
 * `{ sede: <id> }` para quien esta atado a una.
 */
export function limitarASede(peticion, _respuesta, siguiente) {
  if (!peticion.usuario) return siguiente(ErrorApi.noAutenticado());

  peticion.filtroSede =
    peticion.usuario.rol === ROLES.SEDE_ADMIN ? { sede: peticion.usuario.sede } : {};

  return siguiente();
}

/**
 * Cierra la API a quien todavia no ha cambiado su contrasena inicial. Se aplica
 * a todo lo protegido MENOS al propio endpoint de cambio de contrasena y al de
 * cerrar sesion, que deben seguir accesibles.
 */
export function bloquearSiDebeCambiarContrasena(peticion, _respuesta, siguiente) {
  if (peticion.usuario?.debeCambiarContrasena) {
    return siguiente(
      ErrorApi.prohibido('Debes cambiar tu contrasena antes de usar la plataforma'),
    );
  }
  return siguiente();
}
