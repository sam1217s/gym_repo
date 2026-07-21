import { PLANTILLA_VENCIMIENTO, PROVEEDORES_WHATSAPP } from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Configuracion del canal de WhatsApp DE CADA GIMNASIO (`tenant.config.whatsapp`).
 *
 * Lo configura el SUPER_ADMIN, no el dueño, por el mismo motivo que las llaves
 * de Wompi: el token permanente de Meta es un secreto y es mas prudente que lo
 * maneje el operador. Por eso el `tenantId` viene explicito en la URL (el
 * super_admin no opera dentro de un tenant) y no del contexto.
 *
 * El TOKEN nunca se devuelve al cliente; el `idTelefono` y la URL del webhook si
 * (son identificadores, no secretos), para poder verificar que quedo bien puesto.
 *
 * `baileys` no se ofrece a proposito: no esta implementado y elegirlo dejaria el
 * canal roto en silencio hasta la corrida del cron.
 */

function estaConfigurado(proveedor, credenciales) {
  if (proveedor === PROVEEDORES_WHATSAPP.CLOUD_API) {
    return Boolean(credenciales.idTelefono && credenciales.token);
  }
  if (proveedor === PROVEEDORES_WHATSAPP.N8N) return Boolean(credenciales.urlWebhook);
  return false;
}

function describirConfig(whatsapp = {}) {
  const proveedor = whatsapp.proveedor ?? PROVEEDORES_WHATSAPP.NINGUNO;
  const credenciales = whatsapp.credenciales ?? {};

  return {
    proveedor,
    configurado: estaConfigurado(proveedor, credenciales),
    idTelefono: credenciales.idTelefono ?? null,
    urlWebhook: credenciales.urlWebhook ?? null,
    // Que plantilla debe tener aprobada el gimnasio en SU cuenta de Meta.
    plantilla: { nombre: PLANTILLA_VENCIMIENTO.nombre, idioma: PLANTILLA_VENCIMIENTO.idioma },
  };
}

async function exigirTenant(tenantId) {
  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw ErrorApi.noEncontrado('El gimnasio no existe');
  return tenant;
}

export async function obtenerConfigWhatsapp(tenantId) {
  const tenant = await exigirTenant(tenantId);
  return describirConfig(tenant.config?.whatsapp);
}

export async function guardarConfigWhatsapp(tenantId, datos) {
  const tenant = await exigirTenant(tenantId);

  const credenciales =
    datos.proveedor === PROVEEDORES_WHATSAPP.CLOUD_API
      ? { idTelefono: datos.idTelefono, token: datos.token }
      : datos.proveedor === PROVEEDORES_WHATSAPP.N8N
        ? { urlWebhook: datos.urlWebhook }
        : {};

  tenant.set('config.whatsapp', { proveedor: datos.proveedor, credenciales });
  // `credenciales` es Mixed: se marca a mano para que Mongoose lo persista.
  tenant.markModified('config.whatsapp');
  await tenant.save();

  return describirConfig(tenant.config.whatsapp);
}
