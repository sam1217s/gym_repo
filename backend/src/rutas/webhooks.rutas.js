import { Router } from 'express';
import * as controlador from '../controladores/webhooks.controlador.js';
import * as controladorMensajes from '../controladores/mensajes.controlador.js';
import * as controladorMiembro from '../controladores/pagosMiembro.controlador.js';

const rutas = Router();

/**
 * Rutas PUBLICAS: las llama Wompi, no un navegador. No llevan `autenticar`
 * porque no hay cookie que valga; lo que autentica el mensaje es el checksum
 * del evento, que se verifica antes de mirar el cuerpo.
 *
 * Son DOS webhooks porque hay dos niveles de cobro con secretos distintos:
 *   - `/wompi`        -> pago de PLATAFORMA (el gym le paga a GymSaaS)
 *   - `/wompi-miembro`-> pago de MIEMBRO   (el miembro le paga al gym)
 */
rutas.post('/wompi', controlador.recibirEventoWompi);
rutas.post('/wompi-miembro', controladorMiembro.recibirEventoWompiMiembro);

/**
 * WhatsApp (Twilio): los mensajes que mandan los miembros (comprobantes de pago).
 * Mismo criterio que los de Wompi: Twilio manda un POST (form-urlencoded) a esta
 * URL; el numero destino `To` dice de que gimnasio es y con que Auth Token
 * verificar la firma `X-Twilio-Signature`, que es lo que de verdad autentica.
 * (Twilio no hace handshake de alta, asi que no hay GET.)
 */
rutas.post('/whatsapp', controladorMensajes.recibirWebhook);

export default rutas;
