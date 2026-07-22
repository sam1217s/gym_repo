import { PLANTILLA_VENCIMIENTO, PROVEEDORES_WHATSAPP } from '../config/constantes.js';
import { entorno } from '../config/entorno.js';
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

    // --- Bandeja de entrada (recibir comprobantes) ---
    /** Sin el secreto de la app no se puede verificar la firma: no se recibe. */
    recibeMensajes: Boolean(credenciales.secretoApp),
    urlWebhookEntrante: `${entorno.ORIGEN_PUBLICO}/api/webhooks/whatsapp`,
    tokenVerificacion: entorno.WHATSAPP_TOKEN_VERIFICACION,
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

  // Los secretos nunca vuelven al panel, asi que tampoco pueden reenviarse: lo
  // que llegue vacio conserva lo que ya estaba. Sin esto, entrar a poner el
  // secreto de la app borraria el token y dejaria el canal mudo.
  const previas = tenant.config?.whatsapp?.credenciales ?? {};

  let credenciales = {};
  if (datos.proveedor === PROVEEDORES_WHATSAPP.CLOUD_API) {
    const token = datos.token || previas.token;
    if (!token) throw ErrorApi.solicitudInvalida('El token es obligatorio');

    const secretoApp = datos.secretoApp || previas.secretoApp;
    credenciales = {
      idTelefono: datos.idTelefono,
      token,
      // Solo si hay: sin el se envia igual, pero no se reciben mensajes.
      ...(secretoApp ? { secretoApp } : {}),
    };
  } else if (datos.proveedor === PROVEEDORES_WHATSAPP.N8N) {
    credenciales = { urlWebhook: datos.urlWebhook };
  }

  tenant.set('config.whatsapp', { proveedor: datos.proveedor, credenciales });
  // `credenciales` es Mixed: se marca a mano para que Mongoose lo persista.
  tenant.markModified('config.whatsapp');
  await tenant.save();

  return describirConfig(tenant.config.whatsapp);
}
