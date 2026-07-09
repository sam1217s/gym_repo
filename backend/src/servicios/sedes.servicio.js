import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * CRUD de sedes. Coleccion tenant-scoped: el plugin filtra todo por el tenant
 * del contexto, aqui no se ve un solo `tenantId`.
 *
 * El limite `maxSedes` del plan de plataforma se hara cumplir en la Fase 6 con
 * un middleware generico de limites; hasta entonces no se verifica.
 */

const CODIGO_DUPLICADO_MONGO = 11000;

export function listarSedes() {
  const Sede = obtenerModelo('Sede');
  return Sede.find().sort({ createdAt: 1 });
}

export async function crearSede(datos) {
  const Sede = obtenerModelo('Sede');

  try {
    return await Sede.create(datos);
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe una sede con ese nombre');
    }
    throw error;
  }
}

export async function actualizarSede(id, datos) {
  const Sede = obtenerModelo('Sede');
  const sede = await Sede.findById(id);

  if (!sede) throw ErrorApi.noEncontrado('La sede no existe');

  Object.assign(sede, datos);

  try {
    return await sede.save();
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe una sede con ese nombre');
    }
    throw error;
  }
}

/** Lanza si la sede no existe en el tenant actual. Reutilizado por otros servicios. */
export async function exigirSede(id) {
  const Sede = obtenerModelo('Sede');
  const sede = await Sede.findById(id);

  if (!sede) throw ErrorApi.solicitudInvalida('La sede indicada no existe en este gimnasio');
  return sede;
}
