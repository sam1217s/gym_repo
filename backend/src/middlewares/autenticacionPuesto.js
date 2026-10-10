import { ejecutarConContexto } from '../contexto/contextoTenant.js';
import { autenticarTokenPuesto } from '../servicios/puestosAcceso.servicio.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';

const PREFIJO_BEARER = 'Bearer ';

/**
 * Autentica al PC de la puerta por su token (`Authorization: Bearer ...`), no por
 * cookie: el kiosco no es una persona con sesion. Deja `peticion.puesto` y ABRE
 * el contexto de tenant para el resto de la peticion (hace de `autenticar` +
 * `abrirContextoTenant` a la vez). No deja `peticion.usuario`, asi que la
 * auditoria no anota cada huella como un "movimiento" del personal.
 */
export const autenticarPuesto = manejadorAsync(async (peticion, _respuesta, siguiente) => {
  const cabecera = peticion.get('authorization') ?? '';
  if (!cabecera.startsWith(PREFIJO_BEARER)) throw ErrorApi.noAutenticado('Falta el token del puesto');

  const { puesto, tenantId } = await autenticarTokenPuesto(cabecera.slice(PREFIJO_BEARER.length).trim());
  peticion.puesto = puesto;

  return ejecutarConContexto({ tenantId, sedeId: puesto.sede }, siguiente);
});
