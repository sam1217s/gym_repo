import { entorno } from '../config/entorno.js';
import { obtenerContexto } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Configuracion del cobro EN LINEA a los miembros: las llaves Wompi DEL DUENO
 * (nivel de cobro "miembro"), distintas del Wompi de la plataforma.
 *
 * Los secretos NUNCA se devuelven al cliente: solo se dice si estan puestos. La
 * llave publica si se devuelve (es publica por definicion). El dueno la usa
 * junto con la URL del webhook, que se muestra para que la registre en Wompi.
 */

function tenantActual() {
  const tenantId = obtenerContexto()?.tenantId;
  if (!tenantId) throw new Error('cobros.servicio requiere contexto de tenant');
  return tenantId;
}

/** La forma segura para el cliente: sin secretos, con la URL del webhook a registrar. */
function describirConfig(wompi = {}) {
  return {
    configurado: Boolean(wompi.llavePublica && wompi.secretoIntegridad && wompi.secretoEventos),
    llavePublica: wompi.llavePublica ?? null,
    urlWebhook: `${entorno.ORIGEN_PUBLICO}/api/webhooks/wompi-miembro`,
  };
}

export async function obtenerConfigCobros() {
  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(tenantActual());
  if (!tenant) throw ErrorApi.noEncontrado('El gimnasio no existe');
  return describirConfig(tenant.config?.wompi);
}

export async function guardarConfigCobros({ llavePublica, secretoIntegridad, secretoEventos }) {
  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(tenantActual());
  if (!tenant) throw ErrorApi.noEncontrado('El gimnasio no existe');

  tenant.set('config.wompi', { llavePublica, secretoIntegridad, secretoEventos });
  await tenant.save();

  return describirConfig(tenant.config.wompi);
}
