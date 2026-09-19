import { Router } from 'express';
import * as controlador from '../controladores/reportesMaquina.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  requiereDuenoGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';

const rutas = Router();

// Solo el DUEÑO: es su panel de avisos sobre las maquinas de sus sedes.
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  requiereDuenoGimnasio,
);

rutas.get('/', controlador.listarReportes);
rutas.get('/no-leidos', controlador.contarNoLeidos);
rutas.post('/marcar-leidos', controlador.marcarLeidos);

export default rutas;
