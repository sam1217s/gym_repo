import mongoose from 'mongoose';
import { DEDOS } from '../config/constantes.js';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Plantilla de huella de un miembro, para identificarlo en la
 * puerta. DATO SENSIBLE (Ley 1581 de 2012):
 *
 * - Se guarda la PLANTILLA (los puntos que el SDK extrae), nunca la imagen.
 * - Va CIFRADA (`utilidades/cifradoBiometrico.js`) y con `select: false`: ningun
 *   listado la devuelve por accidente; solo la sincronizacion del puesto la pide.
 * - `autorizacion` deja constancia de cuando se acepto el tratamiento y quien lo
 *   registro. Sin ella no se enrola.
 * - Al dar de baja al miembro se borran (`miembros.servicio`).
 *
 * El 1:N (quien es este dedo) lo hace el agente local de la puerta con el SDK de
 * ZKTeco, contra las plantillas que baja de aqui. El backend no compara huellas.
 */
const esquemaHuellaMiembro = new mongoose.Schema(
  {
    miembro: { type: mongoose.Schema.Types.ObjectId, ref: 'Miembro', required: true },
    dedo: { type: String, enum: DEDOS },
    plantillaCifrada: { type: String, required: true, select: false },
    autorizacion: {
      fecha: { type: Date, required: true },
      registradaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    },
  },
  { timestamps: true },
);

esquemaHuellaMiembro.plugin(aislamientoTenant);

esquemaHuellaMiembro.index({ tenant: 1, miembro: 1 });

export const esquema = esquemaHuellaMiembro;
export const nombreModelo = 'HuellaMiembro';
