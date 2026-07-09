import { Router } from 'express';
import * as controlador from '../controladores/auth.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import { validar } from '../middlewares/validar.js';
import {
  esquemaCambiarContrasena,
  esquemaIniciarSesion,
} from '../validaciones/auth.validacion.js';

const rutas = Router();

// --- Publicas -------------------------------------------------------------
rutas.post('/iniciar-sesion', validar(esquemaIniciarSesion), controlador.iniciarSesion);
rutas.post('/refrescar', controlador.refrescar);

// --- Protegidas -----------------------------------------------------------
// Estas tres NO llevan `bloquearSiDebeCambiarContrasena`: un usuario con la
// contrasena inicial pendiente tiene que poder consultarse, cambiarla y salir.
rutas.get('/yo', autenticar, controlador.obtenerSesion);
rutas.post('/cerrar-sesion', autenticar, controlador.cerrarSesion);
rutas.post(
  '/cambiar-contrasena',
  autenticar,
  validar(esquemaCambiarContrasena),
  controlador.cambiarContrasena,
);

export default rutas;
