import { exigirCredenciales } from './NotificacionProvider.js';

const NOMBRE = 'n8n';
const TIEMPO_LIMITE_MS = 10_000;

/**
 * Delega el envio a un flujo de n8n a traves de un webhook. GymSaaS no sabe
 * como termina llegando el mensaje: eso lo decide el gimnasio dentro de n8n.
 *
 * Credenciales: `{ urlWebhook, token? }`.
 */
export function crearProveedorN8n(credenciales) {
  exigirCredenciales(NOMBRE, credenciales, ['urlWebhook']);

  return {
    nombre: NOMBRE,
    habilitado: true,

    async enviar({ telefono, mensaje }) {
      const respuesta = await fetch(credenciales.urlWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(credenciales.token ? { Authorization: `Bearer ${credenciales.token}` } : {}),
        },
        body: JSON.stringify({ telefono, mensaje }),
        signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      });

      if (!respuesta.ok) {
        throw new Error(`n8n respondio ${respuesta.status}`);
      }
    },
  };
}
