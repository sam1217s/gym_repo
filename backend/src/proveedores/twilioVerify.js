import { entorno } from '../config/entorno.js';
import { aE164, autorizacionBasica } from './twilio.proveedor.js';

/**
 * Twilio Verify: envio y comprobacion del codigo OTP para el login por telefono.
 *
 * Twilio genera el codigo, lo manda por SMS o WhatsApp, y controla expiracion,
 * reintentos y rate-limit. Aqui solo se dispara "start" y "check". Se separa del
 * servicio de negocio para poder inyectar un doble en las pruebas (nada de red).
 *
 * `To` va en E.164 (`+57...`) para ambos canales; en WhatsApp, Verify se encarga
 * del prefijo por dentro.
 */

const BASE = 'https://verify.twilio.com/v2/Services';
const TIEMPO_LIMITE_MS = 10_000;

function credenciales() {
  const { TWILIO_ACCOUNT_SID: accountSid, TWILIO_AUTH_TOKEN: authToken } = entorno;
  return { accountSid, authToken };
}

/** `true` si hay credenciales y Verify Service para operar el OTP. */
export function verifyConfigurado() {
  const { accountSid, authToken } = credenciales();
  return Boolean(accountSid && authToken && entorno.TWILIO_VERIFY_SERVICE_SID);
}

async function postForm(url, campos) {
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: autorizacionBasica(credenciales()),
    },
    body: new URLSearchParams(campos),
    signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
  });

  const cuerpo = await respuesta.json().catch(() => ({}));
  return { ok: respuesta.ok, status: respuesta.status, cuerpo };
}

/** Dispara el envio del codigo por el canal elegido (`sms` | `whatsapp`). */
export async function iniciarVerificacion({ telefono, canal }) {
  const url = `${BASE}/${entorno.TWILIO_VERIFY_SERVICE_SID}/Verifications`;
  const r = await postForm(url, { To: aE164(telefono), Channel: canal });
  if (!r.ok) throw new Error(`Twilio Verify respondio ${r.status}`);
  return { estado: r.cuerpo.status };
}

/** Comprueba el codigo. Devuelve `true` solo si Twilio lo aprueba. */
export async function comprobarVerificacion({ telefono, codigo }) {
  const url = `${BASE}/${entorno.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;
  const r = await postForm(url, { To: aE164(telefono), Code: codigo });
  // Un codigo malo puede devolver 404 (verificacion ya no existe): no es aprobado.
  if (!r.ok) return { aprobado: false };
  return { aprobado: r.cuerpo.status === 'approved' };
}
