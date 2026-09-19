import { Router } from 'express';
import * as controlador from '../controladores/auth.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import { limitadorLogin } from '../middlewares/limitadorPeticiones.js';
import { validar } from '../middlewares/validar.js';
import {
  esquemaCambiarContrasena,
  esquemaEnviarOtp,
  esquemaIniciarSesion,
  esquemaMiTelefono,
  esquemaVerificarOtp,
} from '../validaciones/auth.validacion.js';

const rutas = Router();

// --- Publicas -------------------------------------------------------------
// Con limitador: sin el, se pueden probar contrasenas/codigos sin tope (fuerza bruta).
rutas.post('/iniciar-sesion', limitadorLogin, validar(esquemaIniciarSesion), controlador.iniciarSesion);
rutas.post('/refrescar', limitadorLogin, controlador.refrescar);

// Login por telefono con codigo (OTP por SMS/WhatsApp), alternativa a la contrasena.
rutas.post('/otp/enviar', limitadorLogin, validar(esquemaEnviarOtp), controlador.enviarOtp);
rutas.post('/otp/verificar', limitadorLogin, validar(esquemaVerificarOtp), controlador.verificarOtp);

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
// Cada usuario fija su propio telefono para poder entrar por OTP.
rutas.patch('/mi-telefono', autenticar, validar(esquemaMiTelefono), controlador.actualizarMiTelefono);

export default rutas;
