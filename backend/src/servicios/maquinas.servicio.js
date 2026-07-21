import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { exigirSede } from './sedes.servicio.js';

/**
 * Maquinas e implementos del gimnasio, POR SEDE, con su estado de mantenimiento
 * (operativa / mantenimiento / danada).
 *
 * El aislamiento por tenant lo pone el plugin; el alcance por SEDE llega como
 * `filtroSede` desde `limitarASede` (`{}` para el dueno, `{ sede }` para un
 * sede_admin). Mismo contrato que Producto/Miembro/Pago: el filtro del rol gana
 * y va en la BUSQUEDA, asi que una maquina de otra sede es un 404, no un 403.
 */

const CODIGO_DUPLICADO_MONGO = 11000;

export function listarMaquinas(filtroSede = {}, { sede, estado, activo } = {}) {
  const Maquina = obtenerModelo('Maquina');

  const filtro = { ...filtroSede };
  // El filtro del rol gana: un sede_admin no puede pedir otra sede por query.
  if (sede && !filtroSede.sede) filtro.sede = sede;
  if (estado) filtro.estado = estado;
  if (activo !== undefined) filtro.activo = activo === 'true';

  return Maquina.find(filtro).sort({ nombre: 1 });
}

export async function crearMaquina(datos, { filtroSede = {}, sedePorDefecto = null } = {}) {
  const Maquina = obtenerModelo('Maquina');

  // Un sede_admin crea siempre en SU sede, diga lo que diga el cuerpo.
  const sede = filtroSede.sede ?? datos.sede ?? sedePorDefecto;
  if (!sede) throw ErrorApi.solicitudInvalida('Indica la sede de la maquina');

  await exigirSede(sede);

  try {
    return await Maquina.create({
      sede,
      nombre: datos.nombre,
      estado: datos.estado,
      nota: datos.nota,
    });
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe una maquina con ese nombre en esa sede');
    }
    throw error;
  }
}

export async function actualizarMaquina(id, datos, filtroSede = {}) {
  const Maquina = obtenerModelo('Maquina');

  // El filtro de sede va en la BUSQUEDA: para un sede_admin, una maquina de otra
  // sede no existe.
  const maquina = await Maquina.findOne({ _id: id, ...filtroSede });
  if (!maquina) throw ErrorApi.noEncontrado('La maquina no existe');

  Object.assign(maquina, datos);

  try {
    return await maquina.save();
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe una maquina con ese nombre en esa sede');
    }
    throw error;
  }
}

export async function archivarMaquina(id, filtroSede = {}) {
  const Maquina = obtenerModelo('Maquina');

  const maquina = await Maquina.findOne({ _id: id, ...filtroSede });
  if (!maquina) throw ErrorApi.noEncontrado('La maquina no existe');

  maquina.activo = false;
  return maquina.save();
}
