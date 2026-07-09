import mongoose from 'mongoose';
import {
  ESTADOS_TENANT,
  LISTA_ESTADOS_TENANT,
  LISTA_PROVEEDORES_WHATSAPP,
  MONEDA_POR_DEFECTO,
  PROVEEDORES_WHATSAPP,
  ZONA_HORARIA_POR_DEFECTO,
} from '../config/constantes.js';

/**
 * NIVEL PLATAFORMA (no tenant-scoped).
 *
 * Un Tenant es un gimnasio-cliente. Es la raiz del aislamiento: su `_id` es el
 * valor que el plugin `aislamientoTenant` inyecta en todas las consultas de
 * negocio.
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
    estado: {
      type: String,
      enum: LISTA_ESTADOS_TENANT,
      default: ESTADOS_TENANT.TRIAL,
      index: true,
    },
    planPlataforma: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlanPlataforma',
      required: true,
    },
    fechaRegistro: { type: Date, default: Date.now },
    config: {
      moneda: { type: String, default: MONEDA_POR_DEFECTO },
      zonaHoraria: { type: String, default: ZONA_HORARIA_POR_DEFECTO },
      whatsapp: {
        proveedor: {
          type: String,
          enum: LISTA_PROVEEDORES_WHATSAPP,
          default: PROVEEDORES_WHATSAPP.NINGUNO,
        },
        // Credenciales del proveedor. Nunca se serializan hacia el cliente.
        credenciales: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    },
  },
  { timestamps: true },
);

/** Un tenant suspendido o cancelado no puede operar: sus usuarios no entran. */
esquemaTenant.methods.estaOperativo = function () {
  return this.estado === ESTADOS_TENANT.TRIAL || this.estado === ESTADOS_TENANT.ACTIVO;
};

esquemaTenant.set('toJSON', {
  transform(_documento, objeto) {
    delete objeto.config?.whatsapp?.credenciales;
    return objeto;
  },
});

export const esquema = esquemaTenant;
export const nombreModelo = 'Tenant';
