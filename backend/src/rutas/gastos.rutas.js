import { Router } from 'express';
import * as controlador from '../controladores/gastos.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  limitarASede,
  requierePersonalGimnasio,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import { esquemaIdParam } from '../validaciones/comunes.validacion.js';
import {
  esquemaActualizarGasto,
  esquemaCrearGasto,
  esquemaListarGastos,
  esquemaResumenFinanzas,
} from '../validaciones/finanzas.validacion.js';

const rutas = Router();

// `limitarASede` ata al sede_admin a su sede: no ve ni crea gastos generales
// (su filtro es `{ sede }`, que nunca casa con los de `sede: null`).
rutas.use(
  autenticar,
  abrirContextoTenant,
  bloquearSiDebeCambiarContrasena,
  requierePersonalGimnasio,
  limitarASede,
);

// El consolidado: por sede, general y total. Va antes de "/:id" no aplica aqui,
// pero se deja arriba por claridad de lectura.
rutas.get('/resumen', validar(esquemaResumenFinanzas), controlador.resumenFinanzas);

rutas.get('/', validar(esquemaListarGastos), controlador.listarGastos);
rutas.post('/', validar(esquemaCrearGasto), controlador.crearGasto);
rutas.patch('/:id', validar(esquemaActualizarGasto), controlador.actualizarGasto);
// Un gasto SI se borra: nadie lo referencia y una linea mala descuadra el reporte.
rutas.delete('/:id', validar(esquemaIdParam), controlador.eliminarGasto);

export default rutas;
