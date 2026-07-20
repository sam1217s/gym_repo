import { PLANTILLA_VENCIMIENTO } from '../config/constantes.js';
import { exigirCredenciales } from './NotificacionProvider.js';

const NOMBRE = 'cloud_api';
const VERSION_GRAFO = 'v21.0';
const TIEMPO_LIMITE_MS = 10_000;

/**
 * WhatsApp Cloud API de Meta.
 *
 * Envia una PLANTILLA aprobada (`type: 'template'`), no texto libre: Meta solo
 * acepta texto libre dentro de la ventana de 24h desde el ultimo mensaje del
 * usuario, y un aviso de vencimiento casi nunca cae ahi. La plantilla y su
 * idioma son una convencion del proyecto (`PLANTILLA_VENCIMIENTO`): cada
 * gimnasio registra en SU WABA una plantilla con ese nombre. El cuerpo espera
 * las tres variables que le pasa el servicio de notificaciones, en orden:
 * nombre del miembro, gimnasio y fecha de vencimiento.
 *
 * El `mensaje` de texto se sigue recibiendo (lo usan los proveedores de texto y
 * el registro de `Notificacion`), pero aqui NO se envia: el texto de la plantilla
 * lo fija Meta, no GymSaaS.
 *
 * Credenciales: `{ idTelefono, token }`.
 */
export function crearProveedorCloudApi(credenciales, { plantilla = PLANTILLA_VENCIMIENTO } = {}) {
  exigirCredenciales(NOMBRE, credenciales, ['idTelefono', 'token']);

  return {
    nombre: NOMBRE,
    habilitado: true,

    async enviar({ telefono, variables = [] }) {
      const url = `https://graph.facebook.com/${VERSION_GRAFO}/${credenciales.idTelefono}/messages`;

      const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credenciales.token}`,
        },
        body: JSON.stringify(construirCuerpo({ telefono, variables, plantilla })),
        signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      });

      if (!respuesta.ok) {
        throw new Error(`WhatsApp Cloud API respondio ${respuesta.status}`);
      }
    },
  };
}

/**
 * El cuerpo del POST a la Cloud API. Separado y exportado para poder verificar
 * la forma del `template` sin tocar la red (los proveedores no se prueban contra
 * Meta). Cada variable de la plantilla es un parametro de texto del componente
 * `body`, en el mismo orden en que aparecen los `{{n}}`.
 */
export function construirCuerpo({ telefono, variables, plantilla }) {
  return {
    messaging_product: 'whatsapp',
    to: telefono,
    type: 'template',
    template: {
      name: plantilla.nombre,
      language: { code: plantilla.idioma },
      components: [
        {
          type: 'body',
          parameters: variables.map((valor) => ({ type: 'text', text: String(valor) })),
        },
      ],
    },
  };
}
