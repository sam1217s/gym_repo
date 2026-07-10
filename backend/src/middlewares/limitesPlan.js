import { obtenerContexto } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';

/**
 * Hace cumplir los limites del `PlanPlataforma` antes de crear un recurso.
 *
 * Se cuentan solo los recursos ACTIVOS: una sede cerrada o un miembro dado de
 * baja no ocupan cupo. Lo contrario obligaria a un gimnasio a subir de plan por
 * gente que ya no entrena.
 *
 * `estimatedDocumentCount()` esta prohibido en colecciones tenant-scoped (no
 * acepta filtro): aqui siempre se usa `countDocuments()`.
 */

export const RECURSOS = Object.freeze({
  SEDES: 'sedes',
  MIEMBROS: 'miembros',
  USUARIOS: 'usuarios',
});

const CONTADORES = {
  [RECURSOS.SEDES]: {
    limite: 'maxSedes',
    // Tenant-scoped: el plugin inyecta el filtro de tenant.
    contar: () => obtenerModelo('Sede').countDocuments({ activa: true }),
    mensaje: (limite) => `Tu plan permite hasta ${limite} sede(s).`,
  },
  [RECURSOS.MIEMBROS]: {
    limite: 'maxMiembros',
    contar: () => obtenerModelo('Miembro').countDocuments({ activo: true }),
    mensaje: (limite) => `Tu plan permite hasta ${limite} miembro(s) activo(s).`,
  },
  [RECURSOS.USUARIOS]: {
    limite: 'maxUsuarios',
    // `Usuario` NO es tenant-scoped: el filtro va a mano.
    contar: (tenantId) => obtenerModelo('Usuario').countDocuments({ tenant: tenantId, activo: true }),
    mensaje: (limite) => `Tu plan permite hasta ${limite} usuario(s).`,
  },
};

/**
 * @param {'sedes'|'miembros'|'usuarios'} recurso
 */
export function exigirLimite(recurso) {
  const contador = CONTADORES[recurso];
  if (!contador) throw new Error(`Recurso sin limite definido: "${recurso}"`);

  return manejadorAsync(async function verificarLimite(peticion, _respuesta, siguiente) {
    const tenantId = obtenerContexto()?.tenantId;
    if (!tenantId) throw new Error('exigirLimite() requiere abrirContextoTenant() antes');

    const Tenant = obtenerModelo('Tenant');
    const tenant = await Tenant.findById(tenantId).populate('planPlataforma');

    if (!tenant?.planPlataforma) throw ErrorApi.prohibido('El gimnasio no tiene un plan asignado');

    const limite = tenant.planPlataforma.limites[contador.limite];
    const actuales = await contador.contar(tenantId);

    if (actuales >= limite) {
      throw ErrorApi.prohibido(
        `${contador.mensaje(limite)} Ya tienes ${actuales}. Cambia de plan para agregar mas.`,
      );
    }

    return siguiente();
  });
}
