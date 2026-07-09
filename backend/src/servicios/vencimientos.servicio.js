import {
  DIAS_AVISO_VENCIMIENTO,
  ESTADOS_VENCIMIENTO,
  MILISEGUNDOS_POR_DIA,
} from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';

/**
 * EL vencimiento se DERIVA, no se guarda: el estado de un miembro es el
 * `periodoFin` de su ULTIMO pago. Esta es la unica implementacion de esa regla;
 * la usan el panel de miembros y (en la Fase 5) el cron de WhatsApp. Si cambias
 * la consulta aqui, cambia para ambos: ese es el proposito.
 *
 * Sin `$lookup`: el ultimo pago sale de un aggregate sobre `Pago` (el plugin le
 * antepone el `$match` de tenant) y se cruza con los miembros en memoria. Asi
 * no hay sub-pipeline que pueda olvidar su filtro de tenant.
 */

/** Mapa `miembroId -> ultimo Pago` (el de `periodoFin` mas reciente). */
export async function obtenerUltimoPagoPorMiembro(filtroSede = {}) {
  const Pago = obtenerModelo('Pago');

  const filas = await Pago.aggregate([
    { $match: filtroSede },
    { $sort: { miembro: 1, periodoFin: -1 } },
    { $group: { _id: '$miembro', ultimoPago: { $first: '$$ROOT' } } },
  ]);

  return new Map(filas.map((fila) => [String(fila._id), fila.ultimoPago]));
}

/** Estado de membresia que corresponde a un pago (o a su ausencia). */
export function derivarEstado(ultimoPago, ahora = new Date()) {
  if (!ultimoPago) return ESTADOS_VENCIMIENTO.SIN_PAGOS;

  if (ultimoPago.periodoFin < ahora) return ESTADOS_VENCIMIENTO.VENCIDO;

  const umbralAviso = new Date(ahora.getTime() + DIAS_AVISO_VENCIMIENTO * MILISEGUNDOS_POR_DIA);
  if (ultimoPago.periodoFin <= umbralAviso) return ESTADOS_VENCIMIENTO.POR_VENCER;

  return ESTADOS_VENCIMIENTO.AL_DIA;
}

/**
 * Todos los miembros activos del alcance, cada uno con su ultimo pago y su
 * estado derivado. Es la vista que pinta la pantalla de miembros.
 */
export async function listarVencimientos(filtroSede = {}) {
  const Miembro = obtenerModelo('Miembro');

  const [miembros, ultimosPagos] = await Promise.all([
    Miembro.find({ ...filtroSede, activo: true }).sort({ nombres: 1, apellidos: 1 }),
    obtenerUltimoPagoPorMiembro(filtroSede),
  ]);

  const ahora = new Date();

  return miembros.map((miembro) => {
    const ultimoPago = ultimosPagos.get(String(miembro._id)) ?? null;
    return {
      miembro,
      ultimoPago,
      estado: derivarEstado(ultimoPago, ahora),
    };
  });
}
