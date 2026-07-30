import rateLimit from 'express-rate-limit';

import { esPrueba } from '../config/entorno.js';

/**
 * Limitadores de tasa para las rutas publicas sensibles. Sin esto, un atacante
 * puede probar contrasenas (o dar de alta gimnasios) sin tope.
 *
 * Cuenta por IP. Detras de nginx eso exige `app.set('trust proxy', 1)` en
 * `servidor.js`, o todas las peticiones vendrian de la misma IP (el proxy) y
 * compartirian el cupo.
 *
 * En pruebas se desactiva (`skip`): los tests hacen decenas de logins y no deben
 * chocar contra el limite.
 */

const mensaje = { ok: false, data: null, error: { mensaje: 'Demasiados intentos. Espera un momento e intenta de nuevo.', detalles: [] } };

const opcionesBase = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => esPrueba,
  message: mensaje,
};

/** Login y refresco: 10 intentos por IP cada 15 minutos. */
export const limitadorLogin = rateLimit({
  ...opcionesBase,
  windowMs: 15 * 60 * 1000,
  limit: 10,
});

/** Registro publico de gimnasios: 5 por IP cada hora (evita alta masiva). */
export const limitadorRegistro = rateLimit({
  ...opcionesBase,
  windowMs: 60 * 60 * 1000,
  limit: 5,
});
