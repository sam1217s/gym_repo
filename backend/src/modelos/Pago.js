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

    /**
     * `id` de la transaccion de Wompi cuando el pago lo hizo el propio miembro en
     * linea. Es la clave de idempotencia: Wompi reintenta los webhooks, y el
     * indice unico parcial de abajo impide crear el pago dos veces.
     */
    transaccionWompi: { type: String, trim: true },

    fechaPago: { type: Date, required: true, default: Date.now },
    periodoInicio: { type: Date, required: true },
    periodoFin: { type: Date, required: true },

    /**
     * Quien registro el pago. `null` cuando lo pago el propio miembro en linea
     * por Wompi: ahi no hay un usuario del staff detras.
     */
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },

    /**
     * Recordatorios de vencimiento YA enviados de este periodo, como offsets de
     * dias respecto al `periodoFin` (positivo = antes de vencer, negativo =
     * despues). Cada offset de `OFFSETS_AVISO_VENCIMIENTO` se envia una sola vez;
     * aqui se anota cual ya salio para no repetirlo. Al corregir el periodo del
     * pago se vacia (los avisos eran del periodo anterior).
     */
    avisosEnviados: { type: [Number], default: [] },
  },
  { timestamps: true },
);

esquemaPago.plugin(aislamientoTenant);

// Consulta del cron de vencimientos y del panel "proximos a vencer".
esquemaPago.index({ tenant: 1, periodoFin: 1 });

// Ultimo pago de un miembro (ordenado descendente por fin de periodo).
esquemaPago.index({ tenant: 1, miembro: 1, periodoFin: -1 });

// Reportes de ingresos del mes por sede y por metodo de pago.
esquemaPago.index({ tenant: 1, sede: 1, fechaPago: -1 });

/**
 * Idempotencia del pago en linea: una transaccion de Wompi no puede crear dos
 * pagos. Parcial porque `transaccionWompi` solo existe en los pagos por Wompi.
 */
esquemaPago.index(
  { tenant: 1, transaccionWompi: 1 },
  { unique: true, partialFilterExpression: { transaccionWompi: { $type: 'string' } } },
);

export const esquema = esquemaPago;
export const nombreModelo = 'Pago';
