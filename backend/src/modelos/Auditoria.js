import mongoose from 'mongoose';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Bitacora de movimientos del gimnasio: quien hizo que y cuando.
 * La alimenta el middleware `auditar` de forma transversal, tras CADA operacion
 * exitosa que muta datos (crear un miembro, registrar un pago, vender, ajustar
 * stock, reportar una maquina...). El dueño la consulta en su panel de auditoria.
 *
 * Guarda una FOTO del autor (nombre y rol al momento), para que la bitacora se
 * sostenga aunque ese usuario se renombre o se desactive despues. No se edita ni
 * se borra: es un registro historico.
 */
const esquemaAuditoria = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    usuarioNombre: { type: String, required: true, trim: true },
    usuarioRol: { type: String, required: true },
    // Etiqueta legible del movimiento, p.ej. "Registró un pago".
    accion: { type: String, required: true, trim: true },
    // Tipo de recurso afectado, p.ej. "pago", "miembro", "venta".
    recurso: { type: String, trim: true },
    // Dato corto que ayuda a identificar (nombre, monto, estado...). Opcional.
    detalle: { type: String, trim: true },
    // Referencia tecnica, util para depurar. No se muestra al dueño.
    metodo: { type: String },
    ruta: { type: String },
  },
  { timestamps: true },
);

esquemaAuditoria.plugin(aislamientoTenant);

// El panel ordena por fecha descendente dentro del gimnasio.
esquemaAuditoria.index({ tenant: 1, createdAt: -1 });

export const esquema = esquemaAuditoria;
export const nombreModelo = 'Auditoria';
