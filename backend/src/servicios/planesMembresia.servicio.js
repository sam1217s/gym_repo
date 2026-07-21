import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * CRUD de `PlanMembresia`: lo que un miembro le paga al gimnasio.
 * Tenant-scoped; cada gimnasio define los suyos. No confundir con
 * `PlanPlataforma` (lo que el gimnasio le paga a GymSaaS).
 */

const CODIGO_DUPLICADO_MONGO = 11000;

export function listarPlanesMembresia() {
  const PlanMembresia = obtenerModelo('PlanMembresia');
  return PlanMembresia.find().sort({ precio: 1 });
}

export async function crearPlanMembresia(datos) {
  const PlanMembresia = obtenerModelo('PlanMembresia');

  try {
    return await PlanMembresia.create(datos);
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe un plan con ese nombre');
    }
    throw error;
  }
}

export async function actualizarPlanMembresia(id, datos) {
  const PlanMembresia = obtenerModelo('PlanMembresia');
  const plan = await PlanMembresia.findById(id);

  if (!plan) throw ErrorApi.noEncontrado('El plan no existe');

  Object.assign(plan, datos);

  // Un plan lleva UNA sola unidad de duracion: si llego una, se borra la otra,
  // o el hook del modelo rechazaria por tener meses y dias a la vez.
  if (datos.duracionDias != null) plan.duracionMeses = undefined;
  if (datos.duracionMeses != null) plan.duracionDias = undefined;

  try {
    return await plan.save();
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe un plan con ese nombre');
    }
    throw error;
  }
}

/**
 * Los planes no se borran: los pagos historicos los referencian. Archivar
 * (`activo: false`) solo impide usarlos en pagos nuevos.
 */
export async function archivarPlanMembresia(id) {
  const PlanMembresia = obtenerModelo('PlanMembresia');
  const plan = await PlanMembresia.findById(id);

  if (!plan) throw ErrorApi.noEncontrado('El plan no existe');

  plan.activo = false;
  return plan.save();
}
