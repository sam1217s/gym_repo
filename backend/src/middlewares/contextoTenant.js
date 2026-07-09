import { ROLES } from '../config/constantes.js';
import { ejecutarConContexto } from '../contexto/contextoTenant.js';

/**
 * Abre el contexto de tenant para el resto de la peticion.
 *
 * Va SIEMPRE inmediatamente despues de `autenticar`. A partir de aqui, cualquier
 * consulta a una coleccion tenant-scoped queda filtrada de forma automatica.
 *
 * El `super_admin` es el unico que corre fuera de tenant: opera sobre la
 * plataforma, no dentro de un gimnasio.
 */
export function abrirContextoTenant(peticion, _respuesta, siguiente) {
  const { usuario } = peticion;

  if (!usuario) {
    return siguiente(new Error('abrirContextoTenant() requiere autenticar() antes'));
  }

  // Se usa `ejecutarConContexto` (y no `ejecutarSinTenant`) porque aqui `fn` es
  // el `next()` de Express y no debe envolverse en una promesa.
  return ejecutarConContexto(
    {
      tenantId: usuario.rol === ROLES.SUPER_ADMIN ? null : usuario.tenant,
      usuarioId: usuario._id,
      rol: usuario.rol,
      sedeId: usuario.sede,
      omitirAislamiento: usuario.rol === ROLES.SUPER_ADMIN,
    },
    siguiente,
  );
}
