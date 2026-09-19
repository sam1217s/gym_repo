import { ejecutarConContexto } from '../contexto/contextoTenant.js';

/**
 * Abre el contexto de tenant para el resto de la peticion.
 *
 * Va SIEMPRE inmediatamente despues de `autenticar`. A partir de aqui, cualquier
 * consulta a una coleccion tenant-scoped queda filtrada de forma automatica.
 * Todo usuario pertenece al (unico) gimnasio, asi que siempre se abre contexto.
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
      tenantId: usuario.tenant,
      usuarioId: usuario._id,
      rol: usuario.rol,
      sedeId: usuario.sede,
    },
    siguiente,
  );
}
