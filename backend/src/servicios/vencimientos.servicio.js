import {
  DIAS_AVISO_VENCIMIENTO,
  ESTADOS_VENCIMIENTO,
  MILISEGUNDOS_POR_DIA,
  ZONA_HORARIA_POR_DEFECTO,
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

/**
 * El ultimo pago de UN miembro, con el mismo criterio que
 * `obtenerUltimoPagoPorMiembro` (el de `periodoFin` mas reciente). Existe para la
 * puerta, que pregunta por una persona a la vez y no puede agregar todos los
 * pagos del gimnasio en cada huella.
 */
export function obtenerUltimoPago(miembroId) {
  const Pago = obtenerModelo('Pago');
  return Pago.findOne({ miembro: miembroId }).sort({ periodoFin: -1 }).lean();
}

/**
 * Dias de CALENDARIO entre hoy y una fecha, en la zona del gimnasio. Se comparan
 * DIAS CIVILES, no instantes: una mensualidad que vence "el 30" cubre TODO el 30,
 * asi que a cualquier hora del 30 faltan 0 dias ("vence hoy"), no "ya vencio".
 * Restar milisegundos marcaria como vencido el mismo dia pasada la medianoche.
 * Mismo criterio que el cron de avisos (`notificaciones.servicio`).
 */
export function diasCalendarioHasta(fecha, ahora, zonaHoraria = ZONA_HORARIA_POR_DEFECTO) {
  const diaCivil = (valor) =>
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: zonaHoraria,
    }).format(new Date(valor));
  const aUtc = (valor) => Date.parse(`${diaCivil(valor)}T00:00:00Z`);
  return Math.round((aUtc(fecha) - aUtc(ahora)) / MILISEGUNDOS_POR_DIA);
}

/** Estado de membresia que corresponde a un pago (o a su ausencia). */
export function derivarEstado(ultimoPago, ahora = new Date()) {
  if (!ultimoPago) return ESTADOS_VENCIMIENTO.SIN_PAGOS;

  const dias = diasCalendarioHasta(ultimoPago.periodoFin, ahora);

  // dias < 0: el dia de vencimiento ya paso. dias === 0: vence hoy (aun cubierto).
  if (dias < 0) return ESTADOS_VENCIMIENTO.VENCIDO;
  if (dias <= DIAS_AVISO_VENCIMIENTO) return ESTADOS_VENCIMIENTO.POR_VENCER;
  return ESTADOS_VENCIMIENTO.AL_DIA;
}

/**
 * Todos los miembros activos del alcance, cada uno con su ultimo pago y su
 * estado derivado. Es la vista que pinta la pantalla de miembros.
 */
export async function listarVencimientos(filtroSede = {}) {
  const Miembro = obtenerModelo('Miembro');

  const [miembros, ultimosPagos] = await Promise.all([
    // Del mas reciente al mas viejo: un miembro recien creado sale arriba del todo.
    Miembro.find({ ...filtroSede, activo: true }).sort({ createdAt: -1 }),
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
