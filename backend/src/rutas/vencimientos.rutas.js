import { Router } from 'express';
import * as controlador from '../controladores/vencimientos.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  limitarASede,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';

const rutas = Router();

rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  requierePersonalGimnasio,
  limitarASede,
);

rutas.get('/', controlador.listarVencimientos);

export default rutas;
