import { Router } from 'express';
import { estaConectada } from '../config/baseDatos.js';
import { auditar } from '../middlewares/auditoria.js';
import { responderOk } from '../utilidades/respuesta.js';
import rutasAuditoria from './auditoria.rutas.js';
import rutasAuth from './auth.rutas.js';
import rutasDeudas from './deudas.rutas.js';
import rutasGastos from './gastos.rutas.js';
import rutasInventario from './inventario.rutas.js';
import rutasMaquinas from './maquinas.rutas.js';
import rutasMensajes from './mensajes.rutas.js';
import rutasMiembros from './miembros.rutas.js';
import rutasPagos from './pagos.rutas.js';
import rutasPagosMiembro from './pagosMiembro.rutas.js';
import rutasPlanesMembresia from './planesMembresia.rutas.js';
import rutasReportes from './reportes.rutas.js';
import rutasReportesMaquina from './reportesMaquina.rutas.js';
import rutasSedes from './sedes.rutas.js';
import rutasUsuarios from './usuarios.rutas.js';
import rutasVencimientos from './vencimientos.rutas.js';
import rutasVentas from './ventas.rutas.js';
import rutasWebhooks from './webhooks.rutas.js';

const rutas = Router();

rutas.get('/salud', (_peticion, respuesta) =>
  responderOk(respuesta, { estado: 'ok', baseDatos: estaConectada() ? 'conectada' : 'caida' }),
);

// Bitacora transversal: anota cada mutacion exitosa. Va lo primero para que su
// `res.on('finish')` quede registrado antes de que cualquier ruta responda. Las
// rutas publicas (webhooks, /pagar) no tienen usuario, asi que no dejan rastro.
rutas.use(auditar);

// Publica: la llama Wompi. Se autentica por checksum, no por cookie.
rutas.use('/webhooks', rutasWebhooks);

// Publica: el enlace "Pagar ahora" del WhatsApp. Se autentica por el token del
// enlace, no por cookie (quien llega es el celular del miembro).
rutas.use('/pagar', rutasPagosMiembro);

rutas.use('/auth', rutasAuth);
rutas.use('/sedes', rutasSedes);
rutas.use('/usuarios', rutasUsuarios);
rutas.use('/planes-membresia', rutasPlanesMembresia);
rutas.use('/miembros', rutasMiembros);
rutas.use('/inventario', rutasInventario);
rutas.use('/ventas', rutasVentas);
rutas.use('/maquinas', rutasMaquinas);
rutas.use('/mensajes', rutasMensajes);
rutas.use('/pagos', rutasPagos);
rutas.use('/vencimientos', rutasVencimientos);
rutas.use('/reportes', rutasReportes);
rutas.use('/reportes-maquina', rutasReportesMaquina);
rutas.use('/auditoria', rutasAuditoria);
rutas.use('/gastos', rutasGastos);
rutas.use('/deudas', rutasDeudas);

export default rutas;
