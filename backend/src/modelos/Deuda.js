import mongoose from 'mongoose';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Una obligacion con saldo: un credito bancario, un prestamo por
 * maquinas, una cuenta por pagar. Contesta "cuanto DEBO todavia", no solo
 * "cuanto pague" (eso lo cuenta `Gasto`).
 *
 * OJO: la deuda **no guarda** cuanto lleva pagado. El pagado es la SUMA de sus
 * abonos (`Gasto` con `deuda` apuntando aqui) y el saldo se deriva de ahi, igual
 * que el vencimiento de un miembro sale de su ultimo pago. Guardarlo aqui
 * crearia dos fuentes de verdad que divergen en cuanto alguien corrija un abono.
 *
 * `sede` es opcional: normalmente son deudas del DUEÑO (`null`, del gimnasio
 * entero), pero se puede atribuir una a la sede que la genero.
 */
const esquemaDeuda = new mongoose.Schema(
  {
    // `null` = deuda del gimnasio (del dueño), no de una sede concreta.
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', default: null },
    descripcion: { type: String, required: true, trim: true },
    /** A quien se le debe: banco, proveedor, particular. */
    acreedor: { type: String, trim: true },
    montoTotal: { type: Number, required: true, min: 0 },
    fechaInicio: { type: Date, required: true, default: Date.now },
    notas: { type: String, trim: true },
    /** Archivar en vez de borrar: los abonos ya registrados la referencian. */
    activa: { type: Boolean, default: true },
  },
  { timestamps: true },
);

esquemaDeuda.plugin(aislamientoTenant);

esquemaDeuda.index({ tenant: 1, activa: 1, createdAt: -1 });

export const esquema = esquemaDeuda;
export const nombreModelo = 'Deuda';
