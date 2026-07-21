import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { exigirSede } from './sedes.servicio.js';

/**
 * CRUD de `PlanMembresia`: lo que un miembro le paga al gimnasio.
 *
 * Tenant-scoped y POR SEDE: cada sede define sus propios planes (pueden llamarse
 * igual y costar distinto). El alcance por sede llega como `filtroSede` desde
 * `limitarASede`, igual que en Miembro/Pago/Producto: va en la BUSQUEDA, asi que
 * un plan de otra sede es un 404, no un 403.
 *
 * No confundir con `PlanPlataforma` (lo que el gimnasio le paga a GymSaaS).
 */

const CODIGO_DUPLICADO_MONGO = 11000;

export function listarPlanesMembresia(filtroSede = {}, { sede } = {}) {
  const PlanMembresia = obtenerModelo('PlanMembresia');

  const filtro = { ...filtroSede };
  // El filtro del rol gana: un sede_admin no puede pedir otra sede por query.
  if (sede && !filtroSede.sede) filtro.sede = sede;

  return PlanMembresia.find(filtro).sort({ precio: 1 });
}

export async function crearPlanMembresia(datos, { filtroSede = {}, sedePorDefecto = null } = {}) {
  const PlanMembresia = obtenerModelo('PlanMembresia');

  // Un sede_admin crea siempre en SU sede, diga lo que diga el cuerpo.
  const sede = filtroSede.sede ?? datos.sede ?? sedePorDefecto;
  if (!sede) throw ErrorApi.solicitudInvalida('Indica la sede del plan');

  await exigirSede(sede);

  try {
    return await PlanMembresia.create({ ...datos, sede });
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe un plan con ese nombre en esa sede');
    }
    throw error;
  }
}

export async function actualizarPlanMembresia(id, datos, filtroSede = {}) {
  const PlanMembresia = obtenerModelo('PlanMembresia');
  const plan = await PlanMembresia.findOne({ _id: id, ...filtroSede });

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
      throw ErrorApi.conflicto('Ya existe un plan con ese nombre en esa sede');
    }
    throw error;
  }
}

/**
 * Los planes no se borran: los pagos historicos los referencian. Archivar
 * (`activo: false`) solo impide usarlos en pagos nuevos.
 */
export async function archivarPlanMembresia(id, filtroSede = {}) {
  const PlanMembresia = obtenerModelo('PlanMembresia');
  const plan = await PlanMembresia.findOne({ _id: id, ...filtroSede });

  if (!plan) throw ErrorApi.noEncontrado('El plan no existe');

  plan.activo = false;
  return plan.save();
}
