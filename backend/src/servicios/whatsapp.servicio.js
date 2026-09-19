import { PLANTILLA_VENCIMIENTO, PROVEEDORES_WHATSAPP } from '../config/constantes.js';
import { entorno } from '../config/entorno.js';
import { obtenerModelo } from '../modelos/indice.js';
import { aE164 } from '../proveedores/twilio.proveedor.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Configuracion del canal de WhatsApp DE CADA GIMNASIO (`tenant.config.whatsapp`),
 * hoy sobre Twilio.
 *
 * Lo configura el SUPER_ADMIN, no el dueño, por el mismo motivo que las llaves
 * de Wompi: el Auth Token de Twilio es un secreto y es mas prudente que lo maneje
 * el operador. Por eso el `tenantId` viene explicito en la URL (el super_admin
 * no opera dentro de un tenant) y no del contexto.
 *
 * El AUTH TOKEN nunca se devuelve al cliente; el Account SID, el numero y los
 * Content SID de las plantillas si (son identificadores, no secretos), para poder
 * verificar que quedo bien puesto.
 */

function estaConfigurado(proveedor, credenciales) {
  if (proveedor === PROVEEDORES_WHATSAPP.TWILIO) {
    return Boolean(credenciales.accountSid && credenciales.authToken && credenciales.numero);
  }
  if (proveedor === PROVEEDORES_WHATSAPP.N8N) return Boolean(credenciales.urlWebhook);
  return false;
}

function describirConfig(whatsapp = {}) {
  const proveedor = whatsapp.proveedor ?? PROVEEDORES_WHATSAPP.NINGUNO;
  const credenciales = whatsapp.credenciales ?? {};
  const plantillas = credenciales.plantillas ?? {};

  return {
    proveedor,
    configurado: estaConfigurado(proveedor, credenciales),
    accountSid: credenciales.accountSid ?? null,
    numero: credenciales.numero ?? null,
    urlWebhook: credenciales.urlWebhook ?? null,
    // Que Content SID tiene cargado cada plantilla (los valores, no secretos).
    plantillas: {
      vencimiento: plantillas.vencimiento ?? null,
      bienvenida: plantillas.bienvenida ?? null,
      recibo: plantillas.recibo ?? null,
    },
    plantillaReferencia: {
      nombre: PLANTILLA_VENCIMIENTO.nombre,
      idioma: PLANTILLA_VENCIMIENTO.idioma,
    },

    // --- Bandeja de entrada (recibir comprobantes) ---
    /** Con Twilio, el mismo Auth Token verifica la firma de los entrantes. */
    recibeMensajes: estaConfigurado(proveedor, credenciales),
    urlWebhookEntrante: `${entorno.ORIGEN_PUBLICO}/api/webhooks/whatsapp`,
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
  // que llegue vacio conserva lo que ya estaba. Sin esto, entrar a cambiar el
  // numero borraria el Auth Token y dejaria el canal mudo.
  const previas = tenant.config?.whatsapp?.credenciales ?? {};

  let credenciales = {};
  if (datos.proveedor === PROVEEDORES_WHATSAPP.TWILIO) {
    const authToken = datos.authToken || previas.authToken;
    if (!authToken) throw ErrorApi.solicitudInvalida('El Auth Token es obligatorio');

    const plantillasPrevias = previas.plantillas ?? {};
    credenciales = {
      accountSid: datos.accountSid,
      authToken,
      numero: aE164(datos.numero),
      // Los Content SID no son secretos: si llegan vacios se conserva el previo.
      plantillas: {
        vencimiento: datos.plantillaVencimiento || plantillasPrevias.vencimiento || '',
        bienvenida: datos.plantillaBienvenida || plantillasPrevias.bienvenida || '',
        recibo: datos.plantillaRecibo || plantillasPrevias.recibo || '',
      },
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
