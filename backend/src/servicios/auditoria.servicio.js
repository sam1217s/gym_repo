import { ejecutarConTenant } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';

/**
 * Bitacora de movimientos del gimnasio. La escribe el middleware `auditar` y la
 * consulta el dueño en su panel.
 */

/** Cuantos movimientos devuelve el panel por defecto (los mas recientes). */
const LIMITE_POR_DEFECTO = 300;

/**
 * Registra un movimiento. Se llama desde `res.on('finish')`, FUERA del contexto
 * de tenant de la peticion (que ya se cerro), asi que abre uno propio con el
 * `tenantId` capturado. Nunca lanza hacia la peticion: la auditoria no debe
 * romper una operacion que ya se completo.
 */
export async function registrarMovimiento(tenantId, datos) {
  if (!tenantId) return;
  await ejecutarConTenant(tenantId, async () => {
    const Auditoria = obtenerModelo('Auditoria');
    await Auditoria.create(datos);
  });
}

export function listarAuditoria(limite = LIMITE_POR_DEFECTO) {
  const Auditoria = obtenerModelo('Auditoria');
  return Auditoria.find().sort({ createdAt: -1 }).limit(limite);
}
