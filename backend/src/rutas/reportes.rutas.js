import { Router } from 'express';
import * as controlador from '../controladores/reportes.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  limitarASede,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';

const rutas = Router();

// `limitarASede` deja el dueno ver el consolidado y al sede_admin solo su sede.
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  requierePersonalGimnasio,
  limitarASede,
);

rutas.get('/', controlador.obtenerReportePanel);

export default rutas;
