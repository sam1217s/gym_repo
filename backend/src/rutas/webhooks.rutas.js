import { Router } from 'express';
import * as controladorMensajes from '../controladores/mensajes.controlador.js';
import * as controladorMiembro from '../controladores/pagosMiembro.controlador.js';

const rutas = Router();

/**
 * Rutas PUBLICAS: las llama Wompi o Twilio, no un navegador. No llevan
 * `autenticar` porque no hay cookie que valga; lo que autentica el mensaje es su
 * firma, que se verifica antes de mirar el cuerpo.
 *
 * `/wompi-miembro` -> pago EN LINEA de un miembro (el miembro le paga al gym).
 */
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
