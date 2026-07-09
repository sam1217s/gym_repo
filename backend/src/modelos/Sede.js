import mongoose from 'mongoose';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/** TENANT-SCOPED. Una sucursal fisica del gimnasio. */
const esquemaSede = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    direccion: { type: String, required: true, trim: true },
    telefono: { type: String, trim: true },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true },
);

esquemaSede.plugin(aislamientoTenant);

// El nombre de la sede es unico dentro del gimnasio.
esquemaSede.index({ tenant: 1, nombre: 1 }, { unique: true });

export const esquema = esquemaSede;
export const nombreModelo = 'Sede';
