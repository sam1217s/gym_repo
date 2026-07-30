import { ESTADOS_TENANT, ROLES } from '../config/constantes.js';
import { ejecutarConTenant } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Administracion de tenants desde la plataforma: listar, ver y cambiar de
 * estado. Corre siempre como super_admin (contexto con `omitirAislamiento`),
 * por eso puede agregarnos sobre `Sede` sin filtro: es una vista global.
 *
 * La creacion de tenants NO vive aqui sino en `onboarding.servicio.js`, porque
 * un tenant nunca nace solo: nace con su dueno y su primera sede.
 */

export async function listarTenants({ estado } = {}) {
  const Tenant = obtenerModelo('Tenant');
  const filtro = estado ? { estado } : {};

  const tenants = await Tenant.find(filtro)
    .populate('planPlataforma', 'nombre precioMensual')
    .sort({ createdAt: -1 })
    .lean({ virtuals: false });

  const [duenos, sedesPorTenant] = await Promise.all([
    buscarDuenos(tenants.map((tenant) => tenant._id)),
    contarSedesPorTenant(),
  ]);

  return tenants.map((tenant) => ({
    ...sinCredenciales(tenant),
    dueno: duenos.get(String(tenant._id)) ?? null,
    totalSedes: sedesPorTenant.get(String(tenant._id)) ?? 0,
  }));
}

export async function obtenerTenant(id) {
  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(id).populate('planPlataforma');

  if (!tenant) throw ErrorApi.noEncontrado('El gimnasio no existe');

  // Las sedes son tenant-scoped: para leerlas hay que entrar a SU contexto.
  const sedes = await ejecutarConTenant(tenant._id, () => obtenerModelo('Sede').find());
  const duenos = await buscarDuenos([tenant._id]);

  return {
    ...sinCredenciales(tenant.toJSON()),
    dueno: duenos.get(String(tenant._id)) ?? null,
    sedes,
  };
}

/**
 * Edita los datos basicos de un gimnasio (nombre, nit, slug, plan). El ESTADO no
 * se toca aqui: para eso estan suspender/reactivar/cancelar, que validan las
 * transiciones. Los secretos (Wompi, WhatsApp) tampoco: tienen su propio endpoint.
 */
export async function actualizarTenant(id, { dueno, ...datosTenant }) {
  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(id);
  if (!tenant) throw ErrorApi.noEncontrado('El gimnasio no existe');

  // Si se cambia el plan, tiene que existir (no hay FK en Mongo que lo garantice).
  if (datosTenant.planPlataforma) {
    const plan = await obtenerModelo('PlanPlataforma').findById(datosTenant.planPlataforma);
    if (!plan) throw ErrorApi.solicitudInvalida('El plan de plataforma no existe');
  }

  // `datosTenant` ya viene filtrado por Zod: solo nombre/nit/slug/planPlataforma.
  if (Object.keys(datosTenant).length > 0) {
    Object.assign(tenant, datosTenant);
    try {
      await tenant.save();
    } catch (error) {
      // El slug es unico global: si choca con otro gimnasio, es un 11000.
      if (error.code === 11000) {
        throw ErrorApi.conflicto('Ya existe un gimnasio con ese identificador (slug)');
      }
      throw error;
    }
  }

  if (dueno && Object.keys(dueno).length > 0) {
    await actualizarDueno(id, dueno);
  }

  return obtenerTenant(id);
}

/** Edita al dueno (tenant_owner) del gimnasio: nombres, apellidos y correo. */
async function actualizarDueno(tenantId, datos) {
  const Usuario = obtenerModelo('Usuario');
  const dueno = await Usuario.findOne({ tenant: tenantId, rol: ROLES.TENANT_OWNER });
  if (!dueno) throw ErrorApi.noEncontrado('El gimnasio no tiene dueno');

  Object.assign(dueno, datos); // Zod ya acoto a nombres/apellidos/email.

  try {
    await dueno.save();
  } catch (error) {
    // El correo es unico por gimnasio: si choca con otro usuario del mismo, 11000.
    if (error.code === 11000) {
      throw ErrorApi.conflicto('Ya existe un usuario con ese correo en este gimnasio');
    }
    throw error;
  }
}

export function suspenderTenant(id) {
  return cambiarEstado(id, ESTADOS_TENANT.SUSPENDIDO, [
    ESTADOS_TENANT.TRIAL,
    ESTADOS_TENANT.ACTIVO,
  ]);
}

export function reactivarTenant(id) {
  return cambiarEstado(id, ESTADOS_TENANT.ACTIVO, [
    ESTADOS_TENANT.SUSPENDIDO,
    ESTADOS_TENANT.TRIAL,
  ]);
}

/** Cancelar es terminal: no hay transicion que salga de `cancelado`. */
export function cancelarTenant(id) {
  return cambiarEstado(id, ESTADOS_TENANT.CANCELADO, [
    ESTADOS_TENANT.TRIAL,
    ESTADOS_TENANT.ACTIVO,
    ESTADOS_TENANT.SUSPENDIDO,
  ]);
}

async function cambiarEstado(id, estadoNuevo, estadosPermitidos) {
  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(id);

  if (!tenant) throw ErrorApi.noEncontrado('El gimnasio no existe');

  if (!estadosPermitidos.includes(tenant.estado)) {
    throw ErrorApi.conflicto(
      `No se puede pasar un gimnasio de "${tenant.estado}" a "${estadoNuevo}"`,
    );
  }

  tenant.estado = estadoNuevo;
  return tenant.save();
}

/** Dueno (tenant_owner) de cada tenant, indexado por id de tenant. */
async function buscarDuenos(tenantIds) {
  const Usuario = obtenerModelo('Usuario');

  const duenos = await Usuario.find({
    tenant: { $in: tenantIds },
    rol: ROLES.TENANT_OWNER,
  }).select('tenant nombres apellidos email activo');

  return new Map(
    duenos.map((dueno) => [
      String(dueno.tenant),
      {
        id: dueno._id,
        nombres: dueno.nombres,
        apellidos: dueno.apellidos,
        nombreCompleto: dueno.nombreCompleto,
        email: dueno.email,
        activo: dueno.activo,
      },
    ]),
  );
}

/**
 * Conteo global de sedes agrupado por tenant. Solo es legal porque este
 * servicio corre como super_admin (`omitirAislamiento`): es LA vista que
 * cruza todos los gimnasios.
 */
async function contarSedesPorTenant() {
  const Sede = obtenerModelo('Sede');
  const conteos = await Sede.aggregate([{ $group: { _id: '$tenant', total: { $sum: 1 } } }]);

  return new Map(conteos.map((conteo) => [String(conteo._id), conteo.total]));
}

/** Las credenciales de WhatsApp jamas viajan al cliente, ni siquiera al super_admin. */
function sinCredenciales(tenant) {
  if (tenant?.config?.whatsapp) delete tenant.config.whatsapp.credenciales;
  return tenant;
}
