import mongoose from 'mongoose';
import { LISTA_METODOS_PAGO } from '../config/constantes.js';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. El corazon de la contabilidad.
 *
 * `periodoFin` es la fecha de vencimiento de la mensualidad que este pago cubre.
 * Se calcula al registrar el pago (`periodoInicio + plan.duracionMeses`, en meses
 * de calendario) y luego es historia: no se muta. El estado "vencido" de un
 * miembro sale del `periodoFin` de su pago mas reciente.
 */
const esquemaPago = new mongoose.Schema(
  {
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', required: true },
    miembro: { type: mongoose.Schema.Types.ObjectId, ref: 'Miembro', required: true },
    planMembresia: { type: mongoose.Schema.Types.ObjectId, ref: 'PlanMembresia', required: true },

    monto: { type: Number, required: true, min: 0 },
    metodoPago: { type: String, enum: LISTA_METODOS_PAGO, required: true },

    /** Numero de comprobante. Obligatorio en la practica para transferencias. */
    referencia: { type: String, trim: true, default: '' },

    fechaPago: { type: Date, required: true, default: Date.now },
    periodoInicio: { type: Date, required: true },
    periodoFin: { type: Date, required: true },

    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },

    /** `true` cuando el cron ya aviso del vencimiento de este periodo. */
    notificado: { type: Boolean, default: false },
  },
  { timestamps: true },
);

esquemaPago.plugin(aislamientoTenant);

// Consulta del cron de vencimientos y del panel "proximos a vencer".
esquemaPago.index({ tenant: 1, periodoFin: 1 });
esquemaPago.index({ tenant: 1, periodoFin: 1, notificado: 1 });

// Ultimo pago de un miembro (ordenado descendente por fin de periodo).
esquemaPago.index({ tenant: 1, miembro: 1, periodoFin: -1 });

// Reportes de ingresos del mes por sede y por metodo de pago.
esquemaPago.index({ tenant: 1, sede: 1, fechaPago: -1 });

export const esquema = esquemaPago;
export const nombreModelo = 'Pago';
