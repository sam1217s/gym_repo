import { Router } from 'express';
import * as controlador from '../controladores/acceso.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import { bloquearSiDebeCambiarContrasena, requiereDuenoGimnasio } from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import { esquemaCrearPuesto, esquemaIdPuesto } from '../validaciones/acceso.validacion.js';

/** Puestos de entrada de cada sede. Solo el dueño los da de alta y les cambia el token. */
const rutas = Router();

rutas.use(autenticar, abrirContextoTenant, bloquearSiDebeCambiarContrasena, requiereDuenoGimnasio);

rutas.get('/', controlador.listarPuestos);
rutas.post('/', validar(esquemaCrearPuesto), controlador.crearPuesto);
rutas.post('/:id/token', validar(esquemaIdPuesto), controlador.regenerarTokenPuesto);
rutas.delete('/:id', validar(esquemaIdPuesto), controlador.desactivarPuesto);

export default rutas;
