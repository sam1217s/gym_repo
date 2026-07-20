import { Router } from 'express';
import * as controlador from '../controladores/pagosMiembro.controlador.js';

const rutas = Router();

/**
 * Rutas PUBLICAS del pago en linea de un miembro. Sin cookie: quien llega es el
 * celular del miembro desde el boton de WhatsApp. `/gracias` va ANTES que
 * `/:token`, o el parametro se comeria la palabra "gracias".
 */
rutas.get('/gracias', controlador.paginaGracias);
rutas.get('/:token', controlador.redirigirAPago);

export default rutas;
