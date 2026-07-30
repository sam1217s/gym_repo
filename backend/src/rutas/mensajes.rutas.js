import { Router } from 'express';
import * as controlador from '../controladores/mensajes.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  limitarASede,
  requiereDuenoGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import { esquemaIdParam } from '../validaciones/comunes.validacion.js';
import {
  esquemaListarMensajes,
  esquemaMarcarLeidos,
  esquemaResponder,
} from '../validaciones/mensajes.validacion.js';

const rutas = Router();

// La bandeja es SOLO del dueño: es quien revisa los comprobantes y aprueba los
// pagos. `limitarASede` deja su `filtroSede` en `{}` (ve todas las sedes).
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  requiereDuenoGimnasio,
  limitarASede,
);

rutas.get('/pendientes', controlador.contarPendientes);
rutas.get('/', validar(esquemaListarMensajes), controlador.listarMensajes);
rutas.post('/responder', validar(esquemaResponder), controlador.responder);
rutas.post('/marcar-leidos', validar(esquemaMarcarLeidos), controlador.marcarLeidos);
// El comprobante se streamea desde el almacen, nunca se expone la carpeta.
rutas.get('/:id/archivo', validar(esquemaIdParam), controlador.descargarArchivo);

export default rutas;
