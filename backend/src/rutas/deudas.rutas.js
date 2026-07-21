import { Router } from 'express';
import * as controlador from '../controladores/deudas.controlador.js';
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
  esquemaAbonarDeuda,
  esquemaActualizarDeuda,
  esquemaCrearDeuda,
} from '../validaciones/finanzas.validacion.js';

const rutas = Router();

// Solo el DUEÑO: los creditos y demas obligaciones son suyos, no de una sede.
// `limitarASede` se deja por consistencia del contrato (para el dueño es `{}`).
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  bloquearSiGimnasioSuspendido,
  requiereDuenoGimnasio,
  limitarASede,
);

rutas.get('/', controlador.listarDeudas);
rutas.post('/', validar(esquemaCrearDeuda), controlador.crearDeuda);
// Abonar crea un gasto ligado a la deuda: baja el saldo y cuenta como egreso.
rutas.post('/:id/abonos', validar(esquemaAbonarDeuda), controlador.abonarDeuda);
rutas.patch('/:id', validar(esquemaActualizarDeuda), controlador.actualizarDeuda);
// DELETE archiva: los abonos ya registrados la referencian.
rutas.delete('/:id', validar(esquemaIdParam), controlador.archivarDeuda);

export default rutas;
