import { Router } from 'express';
import * as controlador from '../controladores/pagos.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  limitarASede,
  requiereDuenoGimnasio,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import {
  esquemaEditarPago,
  esquemaListarPagos,
  esquemaRegistrarPago,
} from '../validaciones/pagos.validacion.js';

const rutas = Router();

rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  requierePersonalGimnasio,
  limitarASede,
);

rutas.get('/', validar(esquemaListarPagos), controlador.listarPagos);
rutas.post('/', validar(esquemaRegistrarPago), controlador.registrarPago);

// Corregir un pago ya registrado es cosa del DUEÑO (no del sede_admin): toca el
// historial contable y recalcula el vencimiento del miembro.
rutas.patch('/:id', requiereDuenoGimnasio, validar(esquemaEditarPago), controlador.actualizarPago);

export default rutas;
