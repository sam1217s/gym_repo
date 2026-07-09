import mongoose from 'mongoose';
import {
  CANALES_NOTIFICACION,
  ESTADOS_NOTIFICACION,
  TIPOS_NOTIFICACION,
} from '../config/constantes.js';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/** TENANT-SCOPED. Bitacora de los avisos enviados. Solo se escribe, no se edita. */
const esquemaNotificacion = new mongoose.Schema(
  {
    miembro: { type: mongoose.Schema.Types.ObjectId, ref: 'Miembro', required: true },
    canal: {
      type: String,
      enum: Object.values(CANALES_NOTIFICACION),
      default: CANALES_NOTIFICACION.WHATSAPP,
    },
    tipo: {
      type: String,
      enum: Object.values(TIPOS_NOTIFICACION),
      default: TIPOS_NOTIFICACION.PROXIMO_VENCIMIENTO,
    },
    estado: { type: String, enum: Object.values(ESTADOS_NOTIFICACION), required: true },
    mensaje: { type: String, required: true },
    enviadoEn: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

esquemaNotificacion.plugin(aislamientoTenant);

esquemaNotificacion.index({ tenant: 1, miembro: 1, enviadoEn: -1 });
esquemaNotificacion.index({ tenant: 1, enviadoEn: -1 });

export const esquema = esquemaNotificacion;
export const nombreModelo = 'Notificacion';
