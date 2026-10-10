import { Router } from 'express';
import * as controlador from '../controladores/acceso.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  limitarASede,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import { esquemaListarAccesos } from '../validaciones/acceso.validacion.js';

/** Historial de entradas por la puerta. El sede_admin ve las de la puerta de SU sede. */
const rutas = Router();

rutas.use(autenticar, abrirContextoTenant, bloquearSiDebeCambiarContrasena, requierePersonalGimnasio, limitarASede);

rutas.get('/', validar(esquemaListarAccesos), controlador.listarAccesos);

export default rutas;
