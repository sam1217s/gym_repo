import { Router } from 'express';
import * as controlador from '../controladores/auth.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import { validar } from '../middlewares/validar.js';
import {
  esquemaCambiarContrasena,
  esquemaIniciarSesion,
  esquemaRegistrarGimnasio,
  esquemaVerificarEmail,
} from '../validaciones/auth.validacion.js';

const rutas = Router();

// --- Publicas -------------------------------------------------------------
rutas.post('/iniciar-sesion', validar(esquemaIniciarSesion), controlador.iniciarSesion);
rutas.post('/refrescar', controlador.refrescar);

// Registro abierto: cualquiera da de alta su gimnasio. No abre sesion.
rutas.post('/registrar-gimnasio', validar(esquemaRegistrarGimnasio), controlador.registrarGimnasio);
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
