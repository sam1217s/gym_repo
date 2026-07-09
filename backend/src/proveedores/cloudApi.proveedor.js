import { exigirCredenciales } from './NotificacionProvider.js';

const NOMBRE = 'cloud_api';
const VERSION_GRAFO = 'v21.0';
const TIEMPO_LIMITE_MS = 10_000;

/**
 * WhatsApp Cloud API de Meta.
 *
 * OJO para produccion: Meta solo permite texto libre dentro de la ventana de
 * 24 horas desde el ultimo mensaje del usuario. Un aviso de vencimiento casi
 * nunca cae dentro de esa ventana, asi que en produccion habra que registrar
 * una PLANTILLA aprobada y enviar `type: 'template'`. Se deja el envio de texto
 * porque la plantilla depende de la cuenta del gimnasio, que todavia no existe.
 *
 * Credenciales: `{ idTelefono, token }`.
 */
export function crearProveedorCloudApi(credenciales) {
  exigirCredenciales(NOMBRE, credenciales, ['idTelefono', 'token']);

  return {
    nombre: NOMBRE,
    habilitado: true,

    async enviar({ telefono, mensaje }) {
      const url = `https://graph.facebook.com/${VERSION_GRAFO}/${credenciales.idTelefono}/messages`;

      const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credenciales.token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefono,
          type: 'text',
          text: { body: mensaje },
        }),
        signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      });

      if (!respuesta.ok) {
        throw new Error(`WhatsApp Cloud API respondio ${respuesta.status}`);
      }
    },
  };
}
