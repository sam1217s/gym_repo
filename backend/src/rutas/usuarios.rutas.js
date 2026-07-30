import { Router } from 'express';
import * as controlador from '../controladores/usuarios.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  requiereDuenoGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { RECURSOS, exigirLimite } from '../middlewares/limitesPlan.js';
import { validar } from '../middlewares/validar.js';
import { esquemaIdParam } from '../validaciones/comunes.validacion.js';
import {
  esquemaActualizarUsuario,
  esquemaCrearUsuario,
} from '../validaciones/usuarios.validacion.js';

const rutas = Router();

// El staff lo administra SOLO el dueno del gimnasio.
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  requiereDuenoGimnasio,
);

rutas.get('/', controlador.listarUsuarios);
rutas.post(
  '/',
  validar(esquemaCrearUsuario),
  exigirLimite(RECURSOS.USUARIOS),
  controlador.crearUsuario,
);
rutas.patch('/:id', validar(esquemaActualizarUsuario), controlador.actualizarUsuario);
rutas.delete('/:id', validar(esquemaIdParam), controlador.eliminarUsuario);

export default rutas;
