import { Router } from 'express';
import * as controlador from '../controladores/maquinas.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  limitarASede,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import {
  esquemaActualizarMaquina,
  esquemaCrearMaquina,
  esquemaListarMaquinas,
} from '../validaciones/maquinas.validacion.js';

const rutas = Router();

// `limitarASede` deja `peticion.filtroSede`: el sede_admin queda atado a su sede.
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  requierePersonalGimnasio,
  limitarASede,
);

rutas.get('/', validar(esquemaListarMaquinas), controlador.listarMaquinas);
rutas.post('/', validar(esquemaCrearMaquina), controlador.crearMaquina);
rutas.patch('/:id', validar(esquemaActualizarMaquina), controlador.actualizarMaquina);
rutas.delete('/:id', controlador.archivarMaquina);

export default rutas;
