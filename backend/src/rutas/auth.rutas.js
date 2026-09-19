import { Router } from 'express';
import * as controlador from '../controladores/auth.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import { limitadorLogin } from '../middlewares/limitadorPeticiones.js';
import { validar } from '../middlewares/validar.js';
import {
  esquemaCambiarContrasena,
  esquemaIniciarSesion,
} from '../validaciones/auth.validacion.js';

const rutas = Router();

// --- Publicas -------------------------------------------------------------
// Con limitador: sin el, se pueden probar contrasenas sin tope (fuerza bruta).
rutas.post('/iniciar-sesion', limitadorLogin, validar(esquemaIniciarSesion), controlador.iniciarSesion);
rutas.post('/refrescar', limitadorLogin, controlador.refrescar);

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
