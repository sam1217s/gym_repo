import { CATEGORIAS_GASTO } from '../config/constantes.js';
import { obtenerContexto } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Deudas del gimnasio: creditos y demas obligaciones con SALDO.
 *
 * Lo pagado NO se guarda en la deuda: es la suma de sus abonos (`Gasto` con
 * `deuda` apuntando a ella) y el saldo se deriva de ahi. Misma regla que el
 * vencimiento de un miembro, y por el mismo motivo: dos fuentes de verdad
 * acaban divergiendo en cuanto alguien corrige o borra un abono.
 *
 * El panel es del DUEÑO (lo restringe la ruta): son sus obligaciones.
 */

/** Suma de abonos por deuda, para el listado. Sin `$lookup`: se cruza en memoria. */
async function pagadoPorDeuda(idsDeuda) {
  if (idsDeuda.length === 0) return new Map();

  const Gasto = obtenerModelo('Gasto');
  const filas = await Gasto.aggregate([
    { $match: { deuda: { $in: idsDeuda } } },
    { $group: { _id: '$deuda', pagado: { $sum: '$monto' } } },
  ]);

  return new Map(filas.map((fila) => [String(fila._id), fila.pagado]));
}

/** Añade `pagado` y `saldo` (derivados) a una deuda ya leida. */
function conSaldo(deuda, pagado) {
  const plano = typeof deuda.toObject === 'function' ? deuda.toObject() : deuda;
  const abonado = pagado ?? 0;
  return {
    ...plano,
    pagado: abonado,
    saldo: Math.max(plano.montoTotal - abonado, 0),
    saldada: abonado >= plano.montoTotal,
  };
}

export async function listarDeudas(filtroSede = {}) {
  const Deuda = obtenerModelo('Deuda');

  const deudas = await Deuda.find(filtroSede).sort({ createdAt: -1 });
  const pagados = await pagadoPorDeuda(deudas.map((deuda) => deuda._id));

  return deudas.map((deuda) => conSaldo(deuda, pagados.get(String(deuda._id))));
}

export async function crearDeuda(datos, { filtroSede = {} } = {}) {
  const Deuda = obtenerModelo('Deuda');

  // Por defecto es del gimnasio (`null`); se puede atribuir a una sede.
  const sede = filtroSede.sede ?? datos.sede ?? null;

  const deuda = await Deuda.create({
    sede,
    descripcion: datos.descripcion,
    acreedor: datos.acreedor,
    montoTotal: datos.montoTotal,
    fechaInicio: datos.fechaInicio ?? new Date(),
    notas: datos.notas,
  });

  return conSaldo(deuda, 0);
}

export async function actualizarDeuda(id, datos, filtroSede = {}) {
  const Deuda = obtenerModelo('Deuda');

  const deuda = await Deuda.findOne({ _id: id, ...filtroSede });
  if (!deuda) throw ErrorApi.noEncontrado('La deuda no existe');

  Object.assign(deuda, datos);
  await deuda.save();

  const pagados = await pagadoPorDeuda([deuda._id]);
  return conSaldo(deuda, pagados.get(String(deuda._id)));
}

/** Archivar, no borrar: los abonos ya registrados la referencian. */
export async function archivarDeuda(id, filtroSede = {}) {
  const Deuda = obtenerModelo('Deuda');

  const deuda = await Deuda.findOne({ _id: id, ...filtroSede });
  if (!deuda) throw ErrorApi.noEncontrado('La deuda no existe');

  deuda.activa = false;
  await deuda.save();
  return conSaldo(deuda, 0);
}

/**
 * Abonar es pagar: crea un `Gasto` ligado a la deuda (categoria `deuda`), asi
 * que el abono cuenta como egreso del mes Y baja el saldo, sin duplicar nada.
 * El gasto hereda la sede de la deuda para que el resumen lo impute donde toca.
 */
export async function abonarDeuda(id, datos, filtroSede = {}) {
  const Deuda = obtenerModelo('Deuda');
  const Gasto = obtenerModelo('Gasto');

  const deuda = await Deuda.findOne({ _id: id, ...filtroSede });
  if (!deuda) throw ErrorApi.noEncontrado('La deuda no existe');
  if (!deuda.activa) throw ErrorApi.solicitudInvalida('Esa deuda esta archivada');

  const pagados = await pagadoPorDeuda([deuda._id]);
  const saldo = deuda.montoTotal - (pagados.get(String(deuda._id)) ?? 0);

  if (saldo <= 0) throw ErrorApi.solicitudInvalida('Esa deuda ya esta saldada');
  if (datos.monto > saldo) {
    throw ErrorApi.solicitudInvalida(`El abono supera el saldo pendiente (${saldo})`);
  }

  await Gasto.create({
    sede: deuda.sede,
    categoria: CATEGORIAS_GASTO.DEUDA,
    concepto: `Abono: ${deuda.descripcion}`,
    monto: datos.monto,
    fecha: datos.fecha ?? new Date(),
    deuda: deuda._id,
    notas: datos.notas,
    registradoPor: obtenerContexto().usuarioId ?? null,
  });

  const actualizados = await pagadoPorDeuda([deuda._id]);
  return conSaldo(deuda, actualizados.get(String(deuda._id)));
}
