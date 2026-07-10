import mongoose from 'mongoose';
import { ESTADOS_FACTURA, LISTA_ESTADOS_FACTURA, MONEDA_POR_DEFECTO } from '../config/constantes.js';

/**
 * NIVEL PLATAFORMA (no tenant-scoped).
 *
 * Lo que un gimnasio le debe a GymSaaS por un mes de uso. No confundir con
 * `Pago`, que es lo que un miembro le paga al gimnasio: esta coleccion es del
 * otro flujo de dinero, el de arriba.
 *
 * NO lleva el plugin de aislamiento: la cobranza es trabajo de la plataforma y
 * el `super_admin` tiene que poder verlas todas. El aislamiento cuando la
 * consulta un `tenant_owner` se hace a mano, filtrando por `tenant`, igual que
 * en `usuarios.servicio.js`.
 */
const esquemaFacturaPlataforma = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    planPlataforma: { type: mongoose.Schema.Types.ObjectId, ref: 'PlanPlataforma', required: true },

    /** Mes facturado. `periodoInicio` es siempre el dia 1. */
    periodoInicio: { type: Date, required: true },
    periodoFin: { type: Date, required: true },

    monto: { type: Number, required: true, min: 0 },
    moneda: { type: String, default: MONEDA_POR_DEFECTO },

    estado: {
      type: String,
      enum: LISTA_ESTADOS_FACTURA,
      default: ESTADOS_FACTURA.PENDIENTE,
      index: true,
    },

    /**
     * La referencia que viaja a Wompi y vuelve en el webhook. Es la llave con
     * la que se reconoce el pago, asi que es unica e inmutable.
     */
    referencia: { type: String, required: true, unique: true, immutable: true },

    /** Pasado ese dia sin pagar, el cron suspende el gimnasio. */
    fechaVencimiento: { type: Date, required: true, index: true },

    // --- Se llenan cuando Wompi confirma ---
    transaccionId: { type: String, default: null },
    metodoPago: { type: String, default: null },
    pagadaEn: { type: Date, default: null },

    /** Motivo del rechazo, tal como lo manda la pasarela. */
    detalleFallo: { type: String, default: null },
  },
  { timestamps: true },
);

/** Una sola factura por gimnasio y mes: es lo que hace idempotente al cron. */
esquemaFacturaPlataforma.index({ tenant: 1, periodoInicio: 1 }, { unique: true });

/** Consulta del cron de morosos. */
esquemaFacturaPlataforma.index({ estado: 1, fechaVencimiento: 1 });

esquemaFacturaPlataforma.methods.estaPagada = function () {
  return this.estado === ESTADOS_FACTURA.PAGADA;
};

export const esquema = esquemaFacturaPlataforma;
export const nombreModelo = 'FacturaPlataforma';
