import { Router } from 'express';
import * as controlador from '../controladores/acceso.controlador.js';
import { autenticarPuesto } from '../middlewares/autenticacionPuesto.js';
import { validar } from '../middlewares/validar.js';
import { esquemaVerificarAcceso } from '../validaciones/acceso.validacion.js';

/**
 * Lo que llama el PC de la PUERTA. Se autentica con el token del puesto (no con
 * cookie), que ademas abre el contexto de tenant.
 */
const rutas = Router();

rutas.use(autenticarPuesto);

rutas.get('/puesto', controlador.verPuesto);
rutas.get('/huellas', controlador.sincronizarHuellas);
rutas.get('/entradas', controlador.listarEntradasDePuesto);
rutas.post('/verificar', validar(esquemaVerificarAcceso), controlador.verificarAcceso);

export default rutas;
