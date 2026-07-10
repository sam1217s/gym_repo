import { Router } from 'express';
import * as controlador from '../controladores/sedes.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  requiereDuenoGimnasio,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { RECURSOS, exigirLimite } from '../middlewares/limitesPlan.js';
import { validar } from '../middlewares/validar.js';
import { esquemaActualizarSede, esquemaCrearSede } from '../validaciones/sedes.validacion.js';

const rutas = Router();

rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
);

// Leer sedes lo necesita cualquier staff (selects de formularios); escribir, solo el dueno.
rutas.get('/', requierePersonalGimnasio, controlador.listarSedes);
rutas.post(
  '/',
  requiereDuenoGimnasio,
  validar(esquemaCrearSede),
  exigirLimite(RECURSOS.SEDES),
  controlador.crearSede,
);
rutas.patch('/:id', requiereDuenoGimnasio, validar(esquemaActualizarSede), controlador.actualizarSede);

export default rutas;
