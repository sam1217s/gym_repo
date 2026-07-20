import { Router } from 'express';
import * as controlador from '../controladores/plataforma.controlador.js';
import { autenticar } from '../middlewares/autenticacion.js';
import {
  bloquearSiDebeCambiarContrasena,
  requiereSuperAdmin,
} from '../middlewares/autorizacion.js';
import { abrirContextoTenant } from '../middlewares/contextoTenant.js';
import { validar } from '../middlewares/validar.js';
import { esquemaGuardarCobros } from '../validaciones/cobros.validacion.js';
import {
  esquemaActualizarPlan,
  esquemaCrearGimnasio,
  esquemaCrearPlan,
  esquemaIdParam,
  esquemaListarTenants,
} from '../validaciones/plataforma.validacion.js';

const rutas = Router();

// Orden obligatorio: autenticar -> abrirContextoTenant -> bloqueo -> rol.
// Para un super_admin el contexto se abre con `omitirAislamiento`, que es lo
// que le permite ver la plataforma entera.
rutas.use(autenticar, abrirContextoTenant, bloquearSiDebeCambiarContrasena, requiereSuperAdmin);

// --- Planes de plataforma ---------------------------------------------------
rutas.get('/planes', controlador.listarPlanes);
rutas.post('/planes', validar(esquemaCrearPlan), controlador.crearPlan);
rutas.get('/planes/:id', validar(esquemaIdParam), controlador.obtenerPlan);
rutas.patch('/planes/:id', validar(esquemaActualizarPlan), controlador.actualizarPlan);
// DELETE archiva (`activo: false`): los planes nunca se borran porque los tenants los referencian.
rutas.delete('/planes/:id', validar(esquemaIdParam), controlador.archivarPlan);

// --- Tenants ------------------------------------------------------------------
rutas.get('/tenants', validar(esquemaListarTenants), controlador.listarTenants);
rutas.post('/tenants', validar(esquemaCrearGimnasio), controlador.crearGimnasio);
rutas.get('/tenants/:id', validar(esquemaIdParam), controlador.obtenerTenant);
rutas.patch('/tenants/:id/suspender', validar(esquemaIdParam), controlador.suspenderTenant);
rutas.patch('/tenants/:id/reactivar', validar(esquemaIdParam), controlador.reactivarTenant);
rutas.patch('/tenants/:id/cancelar', validar(esquemaIdParam), controlador.cancelarTenant);
rutas.get('/tenants/:id/facturas', validar(esquemaIdParam), controlador.facturasDeTenant);

// Cobro en linea del gimnasio: llaves Wompi del dueno, que el super_admin
// configura por gimnasio (los secretos no se devuelven en el GET).
rutas.get('/tenants/:id/cobros', validar(esquemaIdParam), controlador.configCobrosTenant);
rutas.put('/tenants/:id/cobros', validar(esquemaGuardarCobros), controlador.guardarCobrosTenant);

export default rutas;
