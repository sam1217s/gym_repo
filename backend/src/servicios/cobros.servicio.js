import { entorno } from '../config/entorno.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Configuracion del cobro EN LINEA a los miembros: las llaves Wompi DEL DUENO
 * (nivel de cobro "miembro"), distintas del Wompi de la plataforma.
 *
 * Lo configura el SUPER_ADMIN por gimnasio, no el dueno: son secretos
 * criptograficos y es mas prudente que los maneje el operador de la plataforma.
 * Por eso el `tenantId` viene explicito (el super_admin no opera dentro de un
 * tenant) y no del contexto.
 *
 * Los secretos NUNCA se devuelven al cliente: solo se dice si estan puestos. La
 * llave publica si (es publica por definicion). La URL del webhook se muestra
 * para registrarla en el panel de Wompi del gimnasio.
 */

function describirConfig(wompi = {}) {
  return {
    configurado: Boolean(wompi.llavePublica && wompi.secretoIntegridad && wompi.secretoEventos),
    llavePublica: wompi.llavePublica ?? null,
    urlWebhook: `${entorno.ORIGEN_PUBLICO}/api/webhooks/wompi-miembro`,
  };
}

async function exigirTenant(tenantId) {
  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw ErrorApi.noEncontrado('El gimnasio no existe');
  return tenant;
}

export async function obtenerConfigCobros(tenantId) {
  const tenant = await exigirTenant(tenantId);
  return describirConfig(tenant.config?.wompi);
}

export async function guardarConfigCobros(tenantId, { llavePublica, secretoIntegridad, secretoEventos }) {
  const tenant = await exigirTenant(tenantId);
  tenant.set('config.wompi', { llavePublica, secretoIntegridad, secretoEventos });
  await tenant.save();
  return describirConfig(tenant.config.wompi);
}
