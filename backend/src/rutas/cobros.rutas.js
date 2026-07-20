import { Router } from 'express';
import * as controlador from '../controladores/cobros.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  requiereDuenoGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import { esquemaGuardarCobros } from '../validaciones/cobros.validacion.js';

const rutas = Router();

/** Config del cobro en linea a miembros: solo el dueno del gimnasio. */
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  requiereDuenoGimnasio,
);

rutas.get('/', controlador.verConfig);
rutas.put('/', validar(esquemaGuardarCobros), controlador.guardarConfig);

export default rutas;
