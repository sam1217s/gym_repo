import {
  DIAS_GRACIA_ACCESO,
  ESTADOS_VENCIMIENTO,
  MOTIVOS_ACCESO,
  RESULTADOS_ACCESO,
} from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { sumarDias } from '../utilidades/fechas.js';
import { derivarEstado, diasCalendarioHasta, obtenerUltimoPago } from './vencimientos.servicio.js';

/**
 * La decision de la puerta. La toma SIEMPRE el backend, con la misma regla de
 * vencimiento que el panel y el cron (`derivarEstado` sobre el ULTIMO pago): el
 * agente de la puerta solo dice QUIEN es, nunca si puede pasar. Asi un puesto
 * manipulado no puede abrirle a un vencido.
 */

/**
 * Regla pura: dado el ultimo pago, ¿entra? Al dia y por vencer entran; vencido
 * hasta `DIAS_GRACIA_ACCESO` dias entra "en gracia" (con aviso); mas alla, o sin
 * pagos, no.
 */
export function evaluarAcceso(ultimoPago, ahora = new Date()) {
  const estado = derivarEstado(ultimoPago, ahora);

  if (estado === ESTADOS_VENCIMIENTO.SIN_PAGOS) {
    return { permitido: false, motivo: MOTIVOS_ACCESO.SIN_PAGOS, vence: null, diasRestantes: null, diasVencido: null };
  }

  const dias = diasCalendarioHasta(ultimoPago.periodoFin, ahora);
  const base = { vence: ultimoPago.periodoFin, diasRestantes: null, diasVencido: null };

  if (estado === ESTADOS_VENCIMIENTO.AL_DIA) {
    return { ...base, permitido: true, motivo: MOTIVOS_ACCESO.AL_DIA, diasRestantes: dias };
  }
  if (estado === ESTADOS_VENCIMIENTO.POR_VENCER) {
    return { ...base, permitido: true, motivo: MOTIVOS_ACCESO.POR_VENCER, diasRestantes: dias };
  }

  const diasVencido = -dias;
  return diasVencido <= DIAS_GRACIA_ACCESO
    ? { ...base, permitido: true, motivo: MOTIVOS_ACCESO.EN_GRACIA, diasVencido }
    : { ...base, permitido: false, motivo: MOTIVOS_ACCESO.VENCIDO, diasVencido };
}

/**
 * El puesto identifico a un miembro (por su huella) y pregunta si entra. Deja
 * el intento en el historial y responde lo que la pantalla necesita mostrar.
 * El miembro puede ser de CUALQUIER sede: no se aplica `filtroSede`.
 */
export async function verificarAcceso({ miembro: miembroId, metodo }, puesto) {
  const Miembro = obtenerModelo('Miembro');
  const AccesoPuerta = obtenerModelo('AccesoPuerta');

  const miembro = await Miembro.findById(miembroId);

  let decision;
  if (!miembro || !miembro.activo) {
    decision = { permitido: false, motivo: MOTIVOS_ACCESO.INACTIVO, vence: null, diasRestantes: null, diasVencido: null };
  } else {
    decision = evaluarAcceso(await obtenerUltimoPago(miembro._id));
  }

  await AccesoPuerta.create({
    sede: puesto.sede,
    puesto: puesto._id,
    miembro: miembro?._id ?? null,
    nombreMiembro: miembro?.nombreCompleto ?? '',
    metodo,
    resultado: decision.permitido ? RESULTADOS_ACCESO.PERMITIDO : RESULTADOS_ACCESO.NEGADO,
    motivo: decision.motivo,
    vence: decision.vence,
    diasVencido: decision.diasVencido,
  });

  return {
    ...decision,
    miembro: miembro ? { _id: miembro._id, nombres: miembro.nombres, nombreCompleto: miembro.nombreCompleto } : null,
  };
}

/** Lo que la pantalla de la puerta muestra de si misma: el puesto y el nombre de su sede. */
export async function describirPuesto(puesto) {
  const sede = await obtenerModelo('Sede').findById(puesto.sede).select('nombre').lean();
  return { ...puesto, sedeNombre: sede?.nombre ?? '' };
}

/**
 * Lo que ve el PC de la puerta en su propia ventana: quien paso HOY por su sede.
 * Solo lo justo para la lista (nombre, resultado, motivo, hora): el puesto no es
 * un usuario y no necesita mas datos del miembro.
 */
export async function listarEntradasDePuesto(puesto) {
  const { accesos, resumen } = await listarAccesos({ sede: puesto.sede });
  return {
    resumen,
    accesos: accesos.map(({ _id, nombreMiembro, resultado, motivo, diasVencido, createdAt }) => ({
      _id,
      nombreMiembro,
      resultado,
      motivo,
      diasVencido,
      createdAt,
    })),
  };
}

/**
 * Entradas de UN dia (hoy por defecto), de la mas reciente a la mas vieja, con
 * su resumen. `filtroSede` se aplica sobre la sede de la PUERTA: un sede_admin ve
 * quien entro por la suya, venga de la sede que venga.
 */
export async function listarAccesos(filtroSede = {}, { sede, fecha, resultado } = {}) {
  const AccesoPuerta = obtenerModelo('AccesoPuerta');

  const inicio = fecha ? new Date(fecha) : new Date();
  inicio.setHours(0, 0, 0, 0);
  const fin = sumarDias(inicio, 1);

  const filtro = { ...filtroSede, createdAt: { $gte: inicio, $lt: fin } };
  if (sede && !filtroSede.sede) filtro.sede = sede;
  if (resultado) filtro.resultado = resultado;

  const accesos = await AccesoPuerta.find(filtro).sort({ createdAt: -1 }).populate('sede', 'nombre').lean();

  const permitidos = accesos.filter((acceso) => acceso.resultado === RESULTADOS_ACCESO.PERMITIDO).length;
  return {
    accesos,
    resumen: { total: accesos.length, permitidos, negados: accesos.length - permitidos },
  };
}
