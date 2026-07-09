import mongoose from 'mongoose';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Lo que un miembro le paga al gimnasio.
 * Cada gimnasio define los suyos: "Mensual" 60000 / 30 dias, "Trimestral" 160000 / 90 dias.
 *
 * No confundir con `PlanPlataforma`, que es lo que el gimnasio le paga a GymSaaS.
 */
const esquemaPlanMembresia = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    precio: { type: Number, required: true, min: 0 },
    duracionDias: { type: Number, required: true, min: 1 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

esquemaPlanMembresia.plugin(aislamientoTenant);

esquemaPlanMembresia.index({ tenant: 1, nombre: 1 }, { unique: true });
esquemaPlanMembresia.index({ tenant: 1, activo: 1 });

export const esquema = esquemaPlanMembresia;
export const nombreModelo = 'PlanMembresia';
