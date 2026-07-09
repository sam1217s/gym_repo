import { Router } from 'express';
import * as controlador from '../controladores/pagos.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  limitarASede,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import { esquemaListarPagos, esquemaRegistrarPago } from '../validaciones/pagos.validacion.js';

const rutas = Router();

rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  requierePersonalGimnasio,
  limitarASede,
);

rutas.get('/', validar(esquemaListarPagos), controlador.listarPagos);
rutas.post('/', validar(esquemaRegistrarPago), controlador.registrarPago);

export default rutas;
