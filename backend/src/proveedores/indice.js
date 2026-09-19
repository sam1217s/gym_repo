import { entorno } from '../config/entorno.js';
import { proveedorDeshabilitado } from './NotificacionProvider.js';
import { crearProveedorTwilio } from './twilio.proveedor.js';

/**
 * Unico punto donde se decide QUE implementacion envia las notificaciones. El
 * servicio de notificaciones solo conoce el contrato `NotificacionProvider`.
 *
 * Siendo un solo gimnasio, el canal es Twilio y sus credenciales viven en el
 * ENTORNO (antes se elegian por gimnasio en `tenant.config.whatsapp`). Sin
 * credenciales completas, el proveedor queda deshabilitado (no se envia nada).
 */
function credencialesTwilio() {
  return {
    accountSid: entorno.TWILIO_ACCOUNT_SID,
    authToken: entorno.TWILIO_AUTH_TOKEN,
    numero: entorno.TWILIO_NUMERO,
    plantillas: {
      vencimiento: entorno.TWILIO_CONTENT_SID_VENCIMIENTO,
      bienvenida: entorno.TWILIO_CONTENT_SID_BIENVENIDA,
      recibo: entorno.TWILIO_CONTENT_SID_RECIBO,
    },
  };
}

/** `true` si hay credenciales de Twilio suficientes para operar el canal. */
export function canalConfigurado() {
  const { accountSid, authToken, numero } = credencialesTwilio();
  return Boolean(accountSid && authToken && numero);
}

/**
 * @param {{ plantilla?: object }} [opciones] Plantilla a usar (su Content SID
 *   sale de las credenciales por `PLANTILLA_*.clave`). Sin ella, se usa la de
 *   vencimiento por defecto.
 * @returns {import('./NotificacionProvider.js').NotificacionProvider}
 */
export function crearProveedor(opciones = {}) {
  if (!canalConfigurado()) return proveedorDeshabilitado('twilio');
  return crearProveedorTwilio(credencialesTwilio(), opciones);
}
