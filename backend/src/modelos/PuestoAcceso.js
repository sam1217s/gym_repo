import mongoose from 'mongoose';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Un puesto de entrada: el PC de la puerta de una sede, con el
 * lector de huella y la pantalla de bienvenida.
 *
 * No inicia sesion como un usuario (el kiosco queda encendido dias): se
 * autentica con un token propio `<tenantId>.<puestoId>.<secreto>`. Aqui solo se
 * guarda el SHA-256 del secreto; el token completo se muestra UNA vez al crearlo
 * o regenerarlo. El tenant viaja en el token para abrir el contexto sin saltarse
 * el aislamiento (ver `puestosAcceso.servicio → autenticarTokenPuesto`).
 */
const esquemaPuestoAcceso = new mongoose.Schema(
  {
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', required: true },
    nombre: { type: String, required: true, trim: true },
    tokenHash: { type: String, required: true, select: false },
    activo: { type: Boolean, default: true },
    ultimaConexion: { type: Date, default: null },
  },
  { timestamps: true },
);

esquemaPuestoAcceso.plugin(aislamientoTenant);

esquemaPuestoAcceso.index({ tenant: 1, sede: 1 });

export const esquema = esquemaPuestoAcceso;
export const nombreModelo = 'PuestoAcceso';
