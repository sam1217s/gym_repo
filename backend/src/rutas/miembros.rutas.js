import { Router } from 'express';
import * as controladorAcceso from '../controladores/acceso.controlador.js';
import * as controlador from '../controladores/miembros.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  limitarASede,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import {
  esquemaActualizarMiembro,
  esquemaCrearMiembro,
  esquemaListarMiembros,
} from '../validaciones/miembros.validacion.js';
import {
  esquemaEliminarHuella,
  esquemaListarHuellas,
  esquemaRegistrarHuella,
} from '../validaciones/acceso.validacion.js';

const rutas = Router();

// `limitarASede` deja `peticion.filtroSede`: el sede_admin queda atado a su sede.
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  requierePersonalGimnasio,
  limitarASede,
);

rutas.get('/', validar(esquemaListarMiembros), controlador.listarMiembros);
// Antes de las rutas con `/:id`: "con-huella" no es un id.
rutas.get('/con-huella', controladorAcceso.listarMiembrosConHuella);
rutas.post(
  '/',
  validar(esquemaCrearMiembro),
  controlador.crearMiembro,
);
rutas.patch('/:id', validar(esquemaActualizarMiembro), controlador.actualizarMiembro);

// Huellas para la puerta. Respetan `filtroSede` como el resto de la ficha.
rutas.get('/:id/huellas', validar(esquemaListarHuellas), controladorAcceso.listarHuellas);
rutas.post('/:id/huellas', validar(esquemaRegistrarHuella), controladorAcceso.registrarHuella);
rutas.delete('/:id/huellas/:huellaId', validar(esquemaEliminarHuella), controladorAcceso.eliminarHuella);

export default rutas;
