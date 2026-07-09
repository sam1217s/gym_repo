import { Router } from 'express';
import { estaConectada } from '../config/baseDatos.js';
import { responderOk } from '../utilidades/respuesta.js';
import rutasAuth from './auth.rutas.js';

const rutas = Router();

rutas.get('/salud', (_peticion, respuesta) =>
  responderOk(respuesta, { estado: 'ok', baseDatos: estaConectada() ? 'conectada' : 'caida' }),
);

rutas.use('/auth', rutasAuth);

// Fase 2: rutas.use('/plataforma', rutasPlataforma)
// Fase 3: rutas.use('/sedes', ...), rutas.use('/miembros', ...), rutas.use('/pagos', ...)

export default rutas;
