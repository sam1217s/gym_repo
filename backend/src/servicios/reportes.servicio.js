import { ESTADOS_VENCIMIENTO } from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { listarVencimientos } from './vencimientos.servicio.js';

/**
 * Reportes del panel: ingresos del mes por sede (con su split efectivo vs
 * transferencia) y el conteo de miembros por estado de vencimiento.
 *
 * El conteo de miembros NO recalcula nada: reutiliza `listarVencimientos()`,
 * la misma consulta que pinta la pantalla de miembros. Es la regla de
 * "una sola fuente de verdad" para el vencimiento, aplicada tambien aqui.
 *
 * Los ingresos SI son un aggregate nuevo sobre `Pago`, pero sin `$lookup`:
 * el nombre de cada sede sale de una consulta aparte a `Sede` y se cruza en
 * memoria, exactamente la misma tecnica que `tenants.servicio.js` usa para no
 * pisar la trampa #1 del plugin (un `$lookup` no dispara el aislamiento de la
 * coleccion destino).
 */

function inicioDeMes(ahora = new Date()) {
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1);
}

/** `new Date(2026, -1, 1)` cae en diciembre de 2025: el mes negativo hace rollover solo. */
function inicioDeMesAnterior(ahora = new Date()) {
  return new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
}

/**
 * Variacion relativa contra el mes anterior. Devuelve `null` cuando no hay base
 * con que comparar: un gimnasio que arranca desde cero no "crecio un 100%", y
 * el panel debe poder decir "sin datos del mes pasado" en lugar de un numero
 * inventado.
 */
function calcularVariacion(totalMes, totalMesAnterior) {
  if (totalMesAnterior === 0) return null;
  return (totalMes - totalMesAnterior) / totalMesAnterior;
}

async function sumarIngresosEntre(filtroSede, desde, hasta) {
  const Pago = obtenerModelo('Pago');
  const [fila] = await Pago.aggregate([
    { $match: { ...filtroSede, fechaPago: { $gte: desde, $lt: hasta } } },
    { $group: { _id: null, total: { $sum: '$monto' } } },
  ]);

  return fila?.total ?? 0;
}

export async function obtenerIngresosDelMes(filtroSede = {}) {
  const Sede = obtenerModelo('Sede');
  const Pago = obtenerModelo('Pago');

  // `filtroSede` filtra documentos que REFERENCIAN una sede (Pago.sede); la
  // propia coleccion Sede se identifica por `_id`, no por un campo `sede`.
  const filtroIdentidadSede = filtroSede.sede ? { _id: filtroSede.sede } : {};

  // Se listan TODAS las sedes del alcance, tengan o no ingresos: una sede en
  // cero no debe desaparecer del reporte.
  const sedes = await Sede.find(filtroIdentidadSede).select('nombre').sort({ createdAt: 1 });

  const porSede = new Map(
    sedes.map((sede) => [
      String(sede._id),
      { sede: String(sede._id), sedeNombre: sede.nombre, efectivo: 0, transferencia: 0 },
    ]),
  );

  const filas = await Pago.aggregate([
    { $match: { ...filtroSede, fechaPago: { $gte: inicioDeMes() } } },
    { $group: { _id: { sede: '$sede', metodoPago: '$metodoPago' }, total: { $sum: '$monto' } } },
  ]);

  for (const fila of filas) {
    const entrada = porSede.get(String(fila._id.sede));
    // Una sede pudo haberse eliminado despues del pago; no hay tal borrado hoy,
    // pero la comprobacion evita un crash si algun dia lo hay.
    if (entrada) entrada[fila._id.metodoPago] = fila.total;
  }

  const ingresosPorSede = [...porSede.values()].map((fila) => ({
    ...fila,
    total: fila.efectivo + fila.transferencia,
  }));

  const totalMes = ingresosPorSede.reduce((acumulado, fila) => acumulado + fila.total, 0);

  // El total del mes solo significa algo contra una base: sin el mes anterior,
  // una cifra grande no dice si el gimnasio va bien o va mal.
  const totalMesAnterior = await sumarIngresosEntre(
    filtroSede,
    inicioDeMesAnterior(),
    inicioDeMes(),
  );

  return {
    ingresosPorSede,
    totalMes,
    totalMesAnterior,
    variacion: calcularVariacion(totalMes, totalMesAnterior),
  };
}

export async function obtenerConteoMiembros(filtroSede = {}) {
  const filas = await listarVencimientos(filtroSede);

  const conteo = {
    total: filas.length,
    [ESTADOS_VENCIMIENTO.AL_DIA]: 0,
    [ESTADOS_VENCIMIENTO.POR_VENCER]: 0,
    [ESTADOS_VENCIMIENTO.VENCIDO]: 0,
    [ESTADOS_VENCIMIENTO.SIN_PAGOS]: 0,
  };

  for (const fila of filas) conteo[fila.estado] += 1;

  return conteo;
}

export async function obtenerReportePanel(filtroSede = {}) {
  const [ingresos, miembros] = await Promise.all([
    obtenerIngresosDelMes(filtroSede),
    obtenerConteoMiembros(filtroSede),
  ]);

  return { ...ingresos, miembros };
}
