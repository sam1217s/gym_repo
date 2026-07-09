import { Router } from 'express';
import { estaConectada } from '../config/baseDatos.js';
import { responderOk } from '../utilidades/respuesta.js';
import rutasAuth from './auth.rutas.js';
import rutasMiembros from './miembros.rutas.js';
import rutasPagos from './pagos.rutas.js';
import rutasPlanesMembresia from './planesMembresia.rutas.js';
import rutasPlataforma from './plataforma.rutas.js';
import rutasReportes from './reportes.rutas.js';
import rutasSedes from './sedes.rutas.js';
import rutasUsuarios from './usuarios.rutas.js';
import rutasVencimientos from './vencimientos.rutas.js';

const rutas = Router();

rutas.get('/salud', (_peticion, respuesta) =>
  responderOk(respuesta, { estado: 'ok', baseDatos: estaConectada() ? 'conectada' : 'caida' }),
);

rutas.use('/auth', rutasAuth);
rutas.use('/plataforma', rutasPlataforma);
rutas.use('/sedes', rutasSedes);
rutas.use('/usuarios', rutasUsuarios);
rutas.use('/planes-membresia', rutasPlanesMembresia);
rutas.use('/miembros', rutasMiembros);
rutas.use('/pagos', rutasPagos);
rutas.use('/vencimientos', rutasVencimientos);
rutas.use('/reportes', rutasReportes);

export default rutas;
