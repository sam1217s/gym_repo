import { Router } from 'express';
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
rutas.post('/', validar(esquemaCrearMiembro), controlador.crearMiembro);
rutas.patch('/:id', validar(esquemaActualizarMiembro), controlador.actualizarMiembro);

export default rutas;
