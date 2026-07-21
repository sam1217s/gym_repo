import mongoose from 'mongoose';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Venta de un producto del inventario, POR SEDE. Es el tercer
 * flujo de dinero del sistema (miembro/gimnasio compra un producto EN el
 * mostrador), distinto de la mensualidad del miembro y de la suscripcion del
 * gimnasio a la plataforma: no confundirlos.
 *
 * El `nombreProducto` y el `precioUnitario` se guardan como FOTO del momento de
 * la venta: si luego cambia el precio del producto o se archiva, esta venta
 * conserva lo que de verdad se cobro. `total = cantidad * precioUnitario` se
 * calcula una vez y no se muta.
 */
const esquemaVentaProducto = new mongoose.Schema(
  {
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', required: true },
    producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
    // Foto del nombre al vender (el producto puede renombrarse o archivarse).
    nombreProducto: { type: String, required: true, trim: true },
    cantidad: { type: Number, required: true, min: 1 },
    // Foto del precio unitario al vender.
    precioUnitario: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    // Quien la registro (el encargado de la sede). Nunca nulo: no hay venta sin staff.
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  },
  { timestamps: true },
);

esquemaVentaProducto.plugin(aislamientoTenant);

// El resumen del dia consulta por sede y rango de fecha: tenant primero.
esquemaVentaProducto.index({ tenant: 1, sede: 1, createdAt: -1 });

export const esquema = esquemaVentaProducto;
export const nombreModelo = 'VentaProducto';
