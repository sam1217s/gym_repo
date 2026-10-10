import { obtenerContexto } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { darBienvenida } from './bienvenida.servicio.js';
import { eliminarHuellasDeMiembro } from './huellas.servicio.js';
import { exigirSede } from './sedes.servicio.js';

/**
 * CRUD de miembros (los clientes del gimnasio).
 *
 * El aislamiento por tenant lo pone el plugin; el alcance por SEDE llega desde
 * el middleware `limitarASede` como `filtroSede` (`{}` para el dueno,
 * `{ sede }` para un sede_admin). Todo lo que entra aqui DEBE aplicarlo:
 * es la unica muralla entre un sede_admin y las otras sedes de su gimnasio.
 */

const CODIGO_DUPLICADO_MONGO = 11000;

export function listarMiembros(filtroSede = {}, { sede, activo } = {}) {
  const Miembro = obtenerModelo('Miembro');

  const filtro = { ...filtroSede };
  // El filtro del rol gana: un sede_admin no puede pedir otra sede por query.
  if (sede && !filtroSede.sede) filtro.sede = sede;
  if (activo !== undefined) filtro.activo = activo === 'true';

  return Miembro.find(filtro).sort({ nombres: 1, apellidos: 1 });
}

export async function crearMiembro(datos, { filtroSede = {}, sedePorDefecto = null } = {}) {
  const Miembro = obtenerModelo('Miembro');

  // Un sede_admin registra siempre en SU sede, diga lo que diga el cuerpo.
  const sede = filtroSede.sede ?? datos.sede ?? sedePorDefecto;
  if (!sede) throw ErrorApi.solicitudInvalida('Indica la sede del miembro');

  await exigirSede(sede);

  let miembro;
  try {
    miembro = await Miembro.create({ ...datos, sede });
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe un miembro con ese documento en este gimnasio');
    }
    throw error;
  }

  // Bienvenida por WhatsApp: fire-and-forget. Se captura el tenant AHORA (dentro
  // del contexto) porque el envio corre despues, ya fuera de la peticion. Nunca
  // bloquea ni rompe el alta.
  const { tenantId } = obtenerContexto();
  darBienvenida(miembro, tenantId).catch(() => {});

  return miembro;
}

export async function actualizarMiembro(id, datos, filtroSede = {}) {
  const Miembro = obtenerModelo('Miembro');

  // El filtro de sede va en la BUSQUEDA: para un sede_admin, un miembro de
  // otra sede simplemente no existe.
  const miembro = await Miembro.findOne({ _id: id, ...filtroSede });
  if (!miembro) throw ErrorApi.noEncontrado('El miembro no existe');

  // Mover de sede es cosa del dueno; el sede_admin no puede sacarlo de la suya.
  if (datos.sede && filtroSede.sede) {
    throw ErrorApi.prohibido('Solo el dueno puede mover un miembro de sede');
  }
  if (datos.sede) await exigirSede(datos.sede);

  Object.assign(miembro, datos);

  try {
    const guardado = await miembro.save();
    // Dar de baja borra sus huellas: es dato sensible y deja de tener proposito
    // (Ley 1581). Si vuelve, se le registran de nuevo con nueva autorizacion.
    if (datos.activo === false) await eliminarHuellasDeMiembro(guardado._id);
    return guardado;
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe un miembro con ese documento en este gimnasio');
    }
    throw error;
  }
}
