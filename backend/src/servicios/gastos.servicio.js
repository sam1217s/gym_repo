import { LISTA_CATEGORIAS_GASTO } from '../config/constantes.js';
import { obtenerContexto } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Egresos del gimnasio.
 *
 * Un gasto es de UNA sede o del gimnasio entero (`sede: null`), y de ahi salen
 * las dos trazabilidades: por sede y consolidada. El alcance por sede llega como
 * `filtroSede` desde `limitarASede`; un sede_admin solo ve y crea los de la
 * suya, y por tanto NUNCA ve ni crea los generales (su filtro es `{ sede: X }`,
 * que no casa con `null`). Los generales son cosa del dueño.
 */

/** Primer instante del mes de `fecha`. */
function inicioMes(fecha) {
  const d = new Date(fecha);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Primer instante del mes SIGUIENTE (limite superior exclusivo). */
function inicioMesSiguiente(fecha) {
  const d = new Date(fecha);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function inicioDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDiaExclusivo(fecha) {
  const d = inicioDia(fecha);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Rango a consultar. Sin fechas, el MES actual. */
function resolverRango({ desde, hasta } = {}) {
  if (!desde && !hasta) {
    const hoy = new Date();
    return { inicio: inicioMes(hoy), fin: inicioMesSiguiente(hoy) };
  }
  return {
    inicio: inicioDia(desde ?? hasta),
    fin: finDiaExclusivo(hasta ?? desde),
  };
}

function filtroBase(filtroSede, { sede, categoria } = {}) {
  const filtro = { ...filtroSede };
  // El filtro del rol gana: un sede_admin no puede pedir otra sede por query.
  if (sede && !filtroSede.sede) filtro.sede = sede;
  if (categoria) filtro.categoria = categoria;
  return filtro;
}

export function listarGastos(filtroSede = {}, consulta = {}) {
  const Gasto = obtenerModelo('Gasto');
  const { inicio, fin } = resolverRango(consulta);

  return Gasto.find({ ...filtroBase(filtroSede, consulta), fecha: { $gte: inicio, $lt: fin } }).sort({
    fecha: -1,
  });
}

export async function crearGasto(datos, { filtroSede = {} } = {}) {
  const Gasto = obtenerModelo('Gasto');

  // Un sede_admin registra siempre en SU sede. El dueño puede dejarla vacia, y
  // entonces el gasto es del gimnasio entero.
  const sede = filtroSede.sede ?? datos.sede ?? null;

  return Gasto.create({
    sede,
    categoria: datos.categoria,
    concepto: datos.concepto,
    monto: datos.monto,
    fecha: datos.fecha ?? new Date(),
    notas: datos.notas,
    registradoPor: obtenerContexto().usuarioId ?? null,
  });
}

export async function actualizarGasto(id, datos, filtroSede = {}) {
  const Gasto = obtenerModelo('Gasto');

  // El filtro de sede va en la BUSQUEDA: un gasto de otra sede no existe.
  const gasto = await Gasto.findOne({ _id: id, ...filtroSede });
  if (!gasto) throw ErrorApi.noEncontrado('El gasto no existe');

  // Un abono no se edita por aqui: su monto es el que cuadra el saldo de la
  // deuda. Para corregirlo se borra y se vuelve a abonar.
  if (gasto.deuda) {
    throw ErrorApi.solicitudInvalida('Un abono a una deuda no se edita: bórralo y regístralo de nuevo');
  }

  Object.assign(gasto, datos);
  return gasto.save();
}

/**
 * Los gastos SI se borran (nadie los referencia y una linea equivocada descuadra
 * el reporte). Si el gasto era un abono, borrarlo devuelve el saldo a la deuda
 * por si solo: el saldo se deriva de la suma de los abonos vivos.
 */
export async function eliminarGasto(id, filtroSede = {}) {
  const Gasto = obtenerModelo('Gasto');

  const gasto = await Gasto.findOne({ _id: id, ...filtroSede });
  if (!gasto) throw ErrorApi.noEncontrado('El gasto no existe');

  await gasto.deleteOne();
  return { id };
}

/**
 * El resumen que pide el negocio: cuanto gasto CADA sede (con su desglose por
 * categoria), cuanto se fue en gastos generales del gimnasio, y el consolidado.
 *
 * Se agrega por `{ sede, categoria }` y los nombres de sede se cruzan en memoria
 * con una consulta aparte, sin `$lookup` (la trampa #1 del plugin de tenant).
 */
export async function resumenFinanzas(filtroSede = {}, consulta = {}) {
  const Gasto = obtenerModelo('Gasto');
  const Sede = obtenerModelo('Sede');
  const { inicio, fin } = resolverRango(consulta);

  const [filas, sedes] = await Promise.all([
    Gasto.aggregate([
      { $match: { ...filtroBase(filtroSede), fecha: { $gte: inicio, $lt: fin } } },
      { $group: { _id: { sede: '$sede', categoria: '$categoria' }, total: { $sum: '$monto' } } },
    ]),
    Sede.find(filtroSede.sede ? { _id: filtroSede.sede } : {}).select('nombre activa'),
  ]);

  const vacio = () =>
    LISTA_CATEGORIAS_GASTO.reduce((acc, categoria) => ({ ...acc, [categoria]: 0 }), {});

  // Toda sede visible aparece aunque no haya gastado: un cero es informacion.
  const porSede = new Map(
    sedes.map((sede) => [
      String(sede._id),
      { sede: sede._id, sedeNombre: sede.nombre, total: 0, porCategoria: vacio() },
    ]),
  );
  const general = { total: 0, porCategoria: vacio() };

  for (const fila of filas) {
    const destino = fila._id.sede ? porSede.get(String(fila._id.sede)) : general;
    if (!destino) continue; // sede archivada o fuera del alcance
    destino.porCategoria[fila._id.categoria] += fila.total;
    destino.total += fila.total;
  }

  const listaSedes = [...porSede.values()];
  const total = listaSedes.reduce((suma, s) => suma + s.total, 0) + general.total;

  return { desde: inicio, hasta: fin, porSede: listaSedes, general, total };
}
