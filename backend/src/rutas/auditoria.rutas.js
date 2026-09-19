import { Router } from 'express';
import * as controlador from '../controladores/auditoria.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  requiereDuenoGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';

const rutas = Router();

// Solo el DUEÑO: la bitacora es su vista de control sobre el gimnasio entero.
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  requiereDuenoGimnasio,
);

rutas.get('/', controlador.listarAuditoria);

export default rutas;
