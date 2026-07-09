import mongoose from 'mongoose';

/**
 * NIVEL PLATAFORMA (no tenant-scoped).
 *
 * Lo que un gimnasio le paga a GymSaaS por usar el software. No confundir con
 * `PlanMembresia`, que es lo que un miembro le paga al gimnasio.
 */
const esquemaPlanPlataforma = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, unique: true },
    precioMensual: { type: Number, required: true, min: 0 },
    limites: {
      maxSedes: { type: Number, required: true, min: 1 },
      maxMiembros: { type: Number, required: true, min: 1 },
      maxUsuarios: { type: Number, required: true, min: 1 },
    },
    features: {
      whatsapp: { type: Boolean, default: false },
      reportes: { type: Boolean, default: false },
    },
    activo: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const esquema = esquemaPlanPlataforma;
export const nombreModelo = 'PlanPlataforma';
