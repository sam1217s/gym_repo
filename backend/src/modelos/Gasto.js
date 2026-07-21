import mongoose from 'mongoose';
import { LISTA_CATEGORIAS_GASTO } from '../config/constantes.js';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. La plata que SALE del gimnasio. Es el libro de egresos, la otra
 * cara de `Pago` y `VentaProducto` (que son los ingresos).
 *
 * `sede` es OPCIONAL y ahi esta la clave del modulo:
 *   - con sede  -> gasto de ESA sede (arriendo, servicios, nomina, otros);
 *   - sin sede (`null`) -> gasto del GIMNASIO entero, que es donde caen las
 *     obligaciones del dueño (cuotas de creditos y demas deudas).
 * Asi salen las dos trazabilidades que pide el negocio: por sede y consolidada,
 * sumando todo. Solo el dueño puede registrar gastos generales: a un sede_admin
 * el `filtroSede` le fuerza siempre su sede.
 *
 * `deuda` apunta a la `Deuda` cuando el gasto es un ABONO. De la suma de esos
 * abonos sale el saldo pendiente, que NO se guarda en la deuda (ver `Deuda`).
 */
const esquemaGasto = new mongoose.Schema(
  {
    // `null` = gasto general del gimnasio, no de una sede concreta.
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', default: null },
    categoria: { type: String, enum: LISTA_CATEGORIAS_GASTO, required: true },
    concepto: { type: String, required: true, trim: true },
    monto: { type: Number, required: true, min: 0 },
    fecha: { type: Date, required: true, default: Date.now },
    /** Solo en los abonos: a que deuda se le abono. */
    deuda: { type: mongoose.Schema.Types.ObjectId, ref: 'Deuda', default: null },
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    notas: { type: String, trim: true },
  },
  { timestamps: true },
);

esquemaGasto.plugin(aislamientoTenant);

// El resumen agrupa por sede y categoria dentro de un rango de fechas.
esquemaGasto.index({ tenant: 1, fecha: -1 });
esquemaGasto.index({ tenant: 1, sede: 1, fecha: -1 });
// Saldo de una deuda: suma de sus abonos.
esquemaGasto.index({ tenant: 1, deuda: 1 });

export const esquema = esquemaGasto;
export const nombreModelo = 'Gasto';
