import { obtenerModelo } from '../modelos/indice.js';

/**
 * Reportes de maquinas para el DUEÑO del gimnasio. Los crea `maquinas.servicio`
 * cuando un encargado de sede marca una maquina en mantenimiento o dañada.
 *
 * El dueño ve los de TODAS sus sedes (no lleva `filtroSede`): el aislamiento por
 * tenant del plugin ya acota a su gimnasio, y su alcance es el gimnasio entero.
 * El acceso lo restringe la ruta a `tenant_owner`.
 */

export function listarReportes() {
  const ReporteMaquina = obtenerModelo('ReporteMaquina');
  return ReporteMaquina.find().sort({ createdAt: -1 });
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
