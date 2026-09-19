import { PLANTILLA_VENCIMIENTO } from '../config/constantes.js';
import { exigirCredenciales } from './NotificacionProvider.js';

const NOMBRE = 'twilio';
const TIEMPO_LIMITE_MS = 10_000;

/**
 * Twilio WhatsApp.
 *
 * Envia un "Content Template" aprobado (`ContentSid` + `ContentVariables`), no
 * texto libre: WhatsApp solo acepta texto libre dentro de la ventana de 24h
 * desde el ultimo mensaje del usuario, y un aviso de vencimiento casi nunca cae
 * ahi. Cada plantilla es un Content Template que el gimnasio crea en SU cuenta
 * de Twilio; su Content SID (`HX...`) se guarda en las credenciales bajo la
 * `clave` de la plantilla (`credenciales.plantillas.vencimiento`, etc.).
 *
 * El `mensaje` de texto se sigue recibiendo (lo usan los proveedores de texto y
 * el registro de `Notificacion`), pero aqui NO se envia: el texto de la plantilla
 * lo fija la plantilla aprobada, no GymSaaS.
 *
 * Credenciales: `{ accountSid, authToken, numero, plantillas: { [clave]: 'HX...' } }`.
 * `numero` es el remitente de WhatsApp de Twilio (E.164, con o sin `whatsapp:`).
 */
export function crearProveedorTwilio(credenciales, { plantilla = PLANTILLA_VENCIMIENTO } = {}) {
  exigirCredenciales(NOMBRE, credenciales, ['accountSid', 'authToken', 'numero']);

  return {
    nombre: NOMBRE,
    habilitado: true,

    async enviar({ telefono, variables = [] }) {
      const contentSid = credenciales.plantillas?.[plantilla.clave];
      if (!contentSid) {
        throw new Error(`Twilio: falta el Content SID de la plantilla "${plantilla.clave}"`);
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${credenciales.accountSid}/Messages.json`;

      const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: autorizacionBasica(credenciales),
        },
        body: construirCuerpo({ telefono, variables, from: credenciales.numero, contentSid }),
        signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      });

      if (!respuesta.ok) {
        throw new Error(`Twilio respondio ${respuesta.status}`);
      }
    },
  };
}

/** Cabecera Basic con `AccountSid:AuthToken` (asi autentica la API de Twilio). */
export function autorizacionBasica({ accountSid, authToken }) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

/**
 * Numero en E.164 con '+': quita el prefijo `whatsapp:` y garantiza el '+'. Los
 * telefonos del proyecto se guardan en internacional sin '+' ("573001234567");
 * el remitente puede venir ya con o sin `whatsapp:`/'+'.
 */
export function aE164(numero) {
  const limpio = String(numero).trim().replace(/^whatsapp:/, '');
  return limpio.startsWith('+') ? limpio : `+${limpio}`;
}

/** Formato que exige WhatsApp en Twilio: `whatsapp:+E164`. */
export function aWhatsapp(numero) {
  return `whatsapp:${aE164(numero)}`;
}

/**
 * El cuerpo (form-urlencoded) del POST a Twilio. Separado y exportado para poder
 * verificar su forma sin tocar la red (los proveedores no se prueban contra
 * Twilio). Cada variable de la plantilla es un parametro numerado en
 * `ContentVariables`, en el mismo orden en que aparecen los `{{n}}`.
 */
export function construirCuerpo({ telefono, variables, from, contentSid }) {
  const contentVariables = Object.fromEntries(
    variables.map((valor, indice) => [String(indice + 1), String(valor)]),
  );

  return new URLSearchParams({
    From: aWhatsapp(from),
    To: aWhatsapp(telefono),
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(contentVariables),
  });
}
