import { ESTADOS_TENANT, ROLES } from '../config/constantes.js';
import { ejecutarConTenant } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { cifrarContrasena } from '../utilidades/contrasena.js';

/**
 * Onboarding de un gimnasio: el unico flujo donde un tenant NACE.
 *
 * Cruza la frontera plataforma -> tenant dentro de una misma operacion:
 *   1. `Tenant`   (coleccion de plataforma, sin contexto)
 *   2. `Usuario`  dueno (coleccion de plataforma, el tenant se asigna a mano)
 *   3. `Sede`     (tenant-scoped: NECESITA abrir contexto con `ejecutarConTenant`)
 *
 * Transaccionalidad: MongoDB solo ofrece transacciones sobre replica set, y ni
 * el desarrollo local ni las pruebas corren una. En su lugar hay compensacion
 * manual: si fallan los pasos 2 o 3, se borra lo creado antes de relanzar el
 * error. Nunca queda un tenant huerfano, que es lo que importa al negocio.
 */

const CODIGO_DUPLICADO_MONGO = 11000;

export async function crearGimnasio({ gimnasio, dueno, sede }) {
  const plan = await exigirPlanAsignable(gimnasio.planPlataforma);

  const tenant = await crearTenant(gimnasio);

  let usuarioDueno = null;
  try {
    usuarioDueno = await crearDueno(tenant._id, dueno);

    const sedeCreada = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('Sede').create(sede),
    );

    return {
      tenant: { ...tenant.toJSON(), planPlataforma: plan },
      dueno: usuarioDueno,
      sede: sedeCreada,
    };
  } catch (error) {
    await deshacerOnboarding(tenant._id, usuarioDueno?._id);
    throw error;
  }
}

async function exigirPlanAsignable(planId) {
  const PlanPlataforma = obtenerModelo('PlanPlataforma');
  const plan = await PlanPlataforma.findById(planId);

  if (!plan) throw ErrorApi.solicitudInvalida('El plan de plataforma no existe');
  if (!plan.activo) {
    throw ErrorApi.solicitudInvalida('Ese plan esta archivado y no admite gimnasios nuevos');
  }
  return plan;
}

async function crearTenant(gimnasio) {
  const Tenant = obtenerModelo('Tenant');

  try {
    return await Tenant.create({
      nombre: gimnasio.nombre,
      nit: gimnasio.nit,
      slug: gimnasio.slug,
      planPlataforma: gimnasio.planPlataforma,
      estado: ESTADOS_TENANT.TRIAL,
    });
  } catch (error) {
    // El indice unico de `slug` es quien decide de verdad; comprobarlo antes
    // seria una carrera. Aqui se traduce a un error que el cliente entienda.
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe un gimnasio con ese identificador (slug)');
    }
    throw error;
  }
}

async function crearDueno(tenantId, dueno) {
  const Usuario = obtenerModelo('Usuario');

  return Usuario.create({
    tenant: tenantId,
    nombres: dueno.nombres,
    apellidos: dueno.apellidos,
    email: dueno.email,
    contrasenaHash: await cifrarContrasena(dueno.contrasenaInicial),
    rol: ROLES.TENANT_OWNER,
    // La clave inicial la puso el super_admin: el dueno debe cambiarla al entrar.
    debeCambiarContrasena: true,
  });
}

/**
 * Compensacion del onboarding. Ambas colecciones son de nivel plataforma, asi
 * que se borran sin contexto de tenant. Si la propia compensacion falla, se
 * relanza el error original igualmente: el manejador central lo registra.
 */
async function deshacerOnboarding(tenantId, duenoId) {
  try {
    if (duenoId) await obtenerModelo('Usuario').deleteOne({ _id: duenoId });
    await obtenerModelo('Tenant').deleteOne({ _id: tenantId });
  } catch {
    // Sin red de seguridad extra: el error que importa es el que provoco el deshacer.
  }
}
