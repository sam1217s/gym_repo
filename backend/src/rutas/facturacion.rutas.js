import { Router } from 'express';
import * as controlador from '../controladores/facturacion.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  requiereDuenoGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import { esquemaIdParam } from '../validaciones/comunes.validacion.js';

const rutas = Router();

/**
 * Estas rutas NO llevan `bloquearSiGimnasioSuspendido`, a proposito: es justo
 * el sitio al que tiene que poder llegar un gimnasio suspendido para pagar lo
 * que debe. Suspenderlo y ademas cerrarle la caja seria una trampa.
 */
rutas.use(autenticar, abrirContextoTenant, bloquearSiDebeCambiarContrasena, requiereDuenoGimnasio);

rutas.get('/', controlador.misFacturas);
rutas.post('/:id/enlace-pago', validar(esquemaIdParam), controlador.enlaceDePago);

export default rutas;
