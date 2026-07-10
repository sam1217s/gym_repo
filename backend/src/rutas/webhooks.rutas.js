import { Router } from 'express';
import * as controlador from '../controladores/webhooks.controlador.js';

const rutas = Router();

/**
 * Ruta PUBLICA: la llama Wompi, no un navegador. No lleva `autenticar` porque
 * no hay cookie que valga; lo que autentica el mensaje es el checksum del
 * evento, y eso lo verifica el controlador antes de mirar el cuerpo.
 */
rutas.post('/wompi', controlador.recibirEventoWompi);

export default rutas;
