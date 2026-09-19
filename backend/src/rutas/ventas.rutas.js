import { Router } from 'express';
import * as controlador from '../controladores/ventas.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  limitarASede,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import { esquemaListarVentas, esquemaRegistrarVenta } from '../validaciones/ventas.validacion.js';

const rutas = Router();

// `limitarASede` deja `peticion.filtroSede`: el sede_admin queda atado a su sede.
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  requierePersonalGimnasio,
  limitarASede,
);

rutas.get('/', validar(esquemaListarVentas), controlador.listarVentas);
rutas.post('/', validar(esquemaRegistrarVenta), controlador.registrarVenta);

export default rutas;
