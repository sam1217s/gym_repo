import mongoose from 'mongoose';
import {
  LISTA_METODOS_ACCESO,
  LISTA_MOTIVOS_ACCESO,
  LISTA_RESULTADOS_ACCESO,
} from '../config/constantes.js';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Cada intento de entrada en una puerta, permitido o negado.
 *
 * Registro de EVENTO con foto: guarda el nombre del miembro y el vencimiento que
 * tenia en ese momento, para que el historial se sostenga aunque despues pague,
 * cambie de nombre o se de de baja. `sede` es la de la PUERTA, no la del
 * miembro: un miembro puede entrar a cualquier sede del gimnasio.
 */
const esquemaAccesoPuerta = new mongoose.Schema(
  {
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', required: true },
    puesto: { type: mongoose.Schema.Types.ObjectId, ref: 'PuestoAcceso', required: true },
    // null si la huella ya no corresponde a un miembro (borrado entre sincronizaciones).
    miembro: { type: mongoose.Schema.Types.ObjectId, ref: 'Miembro', default: null },
    nombreMiembro: { type: String, trim: true, default: '' },
    metodo: { type: String, enum: LISTA_METODOS_ACCESO, required: true },
    resultado: { type: String, enum: LISTA_RESULTADOS_ACCESO, required: true },
    motivo: { type: String, enum: LISTA_MOTIVOS_ACCESO, required: true },
    vence: { type: Date, default: null },
    diasVencido: { type: Number, default: null },
  },
  { timestamps: true },
);

esquemaAccesoPuerta.plugin(aislamientoTenant);

esquemaAccesoPuerta.index({ tenant: 1, createdAt: -1 });
esquemaAccesoPuerta.index({ tenant: 1, sede: 1, createdAt: -1 });
esquemaAccesoPuerta.index({ tenant: 1, miembro: 1, createdAt: -1 });

export const esquema = esquemaAccesoPuerta;
export const nombreModelo = 'AccesoPuerta';
