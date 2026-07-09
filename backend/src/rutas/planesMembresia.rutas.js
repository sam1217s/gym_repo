import { Router } from 'express';
import * as controlador from '../controladores/planesMembresia.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  requiereDuenoGimnasio,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import { esquemaIdParam } from '../validaciones/comunes.validacion.js';
import {
  esquemaActualizarPlanMembresia,
  esquemaCrearPlanMembresia,
} from '../validaciones/planesMembresia.validacion.js';

const rutas = Router();

rutas.use(autenticar, abrirContextoTenant, bloquearSiDebeCambiarContrasena);

// Leerlos lo necesita cualquier staff (el formulario de pago); definirlos, el dueno.
rutas.get('/', requierePersonalGimnasio, controlador.listarPlanesMembresia);
rutas.post('/', requiereDuenoGimnasio, validar(esquemaCrearPlanMembresia), controlador.crearPlanMembresia);
rutas.patch('/:id', requiereDuenoGimnasio, validar(esquemaActualizarPlanMembresia), controlador.actualizarPlanMembresia);
// DELETE archiva: los pagos historicos referencian el plan.
rutas.delete('/:id', requiereDuenoGimnasio, validar(esquemaIdParam), controlador.archivarPlanMembresia);

export default rutas;
