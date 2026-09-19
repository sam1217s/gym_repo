import { Router } from 'express';
import * as controlador from '../controladores/inventario.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  limitarASede,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import {
  esquemaAjustarStock,
  esquemaActualizarProducto,
  esquemaCrearProducto,
  esquemaListarInventario,
} from '../validaciones/inventario.validacion.js';

const rutas = Router();

// `limitarASede` deja `peticion.filtroSede`: el sede_admin queda atado a su sede.
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  requierePersonalGimnasio,
  limitarASede,
);

rutas.get('/', validar(esquemaListarInventario), controlador.listarInventario);
rutas.post('/', validar(esquemaCrearProducto), controlador.crearProducto);
rutas.patch('/:id/ajuste', validar(esquemaAjustarStock), controlador.ajustarStock);
rutas.patch('/:id', validar(esquemaActualizarProducto), controlador.actualizarProducto);
rutas.delete('/:id', controlador.archivarProducto);

export default rutas;
