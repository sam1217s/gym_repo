import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * CRUD de `PlanPlataforma`: lo que un gimnasio le paga a GymSaaS. Coleccion de
 * nivel plataforma (sin plugin de aislamiento); solo la toca el super_admin.
 */

const CODIGO_DUPLICADO_MONGO = 11000;

export function listarPlanes() {
  const PlanPlataforma = obtenerModelo('PlanPlataforma');
  return PlanPlataforma.find().sort({ precioMensual: 1 });
}

export async function obtenerPlan(id) {
  const PlanPlataforma = obtenerModelo('PlanPlataforma');
  const plan = await PlanPlataforma.findById(id);

  if (!plan) throw ErrorApi.noEncontrado('El plan no existe');
  return plan;
}

export async function crearPlan(datos) {
  const PlanPlataforma = obtenerModelo('PlanPlataforma');

  try {
    return await PlanPlataforma.create(datos);
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe un plan con ese nombre');
    }
    throw error;
  }
}

export async function actualizarPlan(id, datos) {
  const plan = await obtenerPlan(id);

  // Asignacion parcial: `limites` y `features` pueden venir incompletos y solo
  // deben pisar las claves presentes, no el subdocumento entero.
  const { limites, features, ...planos } = datos;
  if (limites) Object.assign(plan.limites, limites);
  if (features) Object.assign(plan.features, features);
  Object.assign(plan, planos);

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
 * Los planes no se borran: los tenants existentes los referencian. Archivar
 * (`activo: false`) impide asignarlos a gimnasios nuevos sin romper a nadie.
 */
export async function archivarPlan(id) {
  const plan = await obtenerPlan(id);

  plan.activo = false;
  return plan.save();
}
