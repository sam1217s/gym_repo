import mongoose from 'mongoose';
import { MONEDA_POR_DEFECTO, ZONA_HORARIA_POR_DEFECTO } from '../config/constantes.js';

/**
 * NIVEL PLATAFORMA (no tenant-scoped).
 *
 * Un Tenant es el gimnasio. Es la raiz del aislamiento: su `_id` es el valor que
 * el plugin `aislamientoTenant` inyecta en todas las consultas de negocio.
 *
 * Siendo software a la medida, existe UN solo Tenant. Se conserva la entidad
 * (y el aislamiento) como red de seguridad; la config de canales (Twilio, Wompi
 * del miembro) ya no vive aqui sino en el entorno.
 */
const esquemaTenant = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    nit: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'El slug solo admite minusculas, numeros y guiones'],
    },
    fechaRegistro: { type: Date, default: Date.now },
    config: {
      moneda: { type: String, default: MONEDA_POR_DEFECTO },
      zonaHoraria: { type: String, default: ZONA_HORARIA_POR_DEFECTO },
    },
  },
  { timestamps: true },
);

export const esquema = esquemaTenant;
export const nombreModelo = 'Tenant';
