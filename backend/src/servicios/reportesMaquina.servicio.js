import { obtenerModelo } from '../modelos/indice.js';

/**
 * Reportes de maquinas para el DUEÑO del gimnasio. Los crea `maquinas.servicio`
 * cuando un encargado de sede marca una maquina en mantenimiento o dañada.
 *
 * El dueño ve los de TODAS sus sedes (no lleva `filtroSede`): el aislamiento por
 * tenant del plugin ya acota a su gimnasio, y su alcance es el gimnasio entero.
 * El acceso lo restringe la ruta a `tenant_owner`.
 */

/**
 * Los reportes con el estado ACTUAL de cada maquina.
 *
 * El reporte guarda el estado del momento en que se reporto (es un evento); el
 * dueño necesita ademas saber como esta la maquina HOY para distinguir lo ya
 * resuelto de lo que sigue pendiente. Se cruza en memoria con una consulta
 * aparte, sin `$lookup` (la trampa #1 del plugin de tenant).
 *
 * `estadoActual` es `null` si la maquina ya no existe: el reporte se sostiene
 * igual, porque guarda su propia foto.
 */
export async function listarReportes() {
  const ReporteMaquina = obtenerModelo('ReporteMaquina');
  const Maquina = obtenerModelo('Maquina');

  const reportes = await ReporteMaquina.find().sort({ createdAt: -1 });
  if (reportes.length === 0) return [];

  const maquinas = await Maquina.find({
    _id: { $in: reportes.map((reporte) => reporte.maquina) },
  }).select('estado');

  const estadoPorMaquina = new Map(maquinas.map((maquina) => [String(maquina._id), maquina.estado]));

  return reportes.map((reporte) => ({
    ...reporte.toObject(),
    estadoActual: estadoPorMaquina.get(String(reporte.maquina)) ?? null,
  }));
}

export async function contarNoLeidos() {
  const ReporteMaquina = obtenerModelo('ReporteMaquina');
  return ReporteMaquina.countDocuments({ leido: false });
}

/**
 * Marca como leidos todos los reportes pendientes. Se llama cuando el dueño abre
 * su panel: a partir de ahi dejan de dispararle la notificacion de inicio de
 * sesion, aunque la maquina siga sin arreglarse. Devuelve cuantos se marcaron.
 */
export async function marcarLeidos() {
  const ReporteMaquina = obtenerModelo('ReporteMaquina');
  const resultado = await ReporteMaquina.updateMany({ leido: false }, { $set: { leido: true } });
  return resultado.modifiedCount ?? 0;
}
