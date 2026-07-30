import { Router } from 'express';
import * as controlador from '../controladores/auth.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import { limitadorLogin, limitadorRegistro } from '../middlewares/limitadorPeticiones.js';
import { validar } from '../middlewares/validar.js';
import {
  esquemaCambiarContrasena,
  esquemaIniciarSesion,
  esquemaRegistrarGimnasio,
  esquemaVerificarEmail,
} from '../validaciones/auth.validacion.js';

const rutas = Router();

// --- Publicas -------------------------------------------------------------
// Con limitador: sin el, se pueden probar contrasenas sin tope (fuerza bruta).
rutas.post('/iniciar-sesion', limitadorLogin, validar(esquemaIniciarSesion), controlador.iniciarSesion);
rutas.post('/refrescar', limitadorLogin, controlador.refrescar);

// Registro abierto: cualquiera da de alta su gimnasio. No abre sesion.
rutas.post(
  '/registrar-gimnasio',
  limitadorRegistro,
  validar(esquemaRegistrarGimnasio),
  controlador.registrarGimnasio,
);
rutas.get('/verificar-email', validar(esquemaVerificarEmail), controlador.verificarEmail);

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
