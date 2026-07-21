import mongoose from 'mongoose';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Inventario del gimnasio, POR SEDE: suplementos, ropa,
 * accesorios... cada uno con sus existencias.
 *
 * El aislamiento por tenant lo pone el plugin; el alcance por sede lo aplican
 * los servicios con `filtroSede` (igual que Miembro/Pago), asi que un sede_admin
 * solo ve y toca el inventario de SU sede.
 */
const esquemaProducto = new mongoose.Schema(
  {
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', required: true },
    nombre: { type: String, required: true, trim: true },
    // Existencias actuales. Nunca baja de 0 (el servicio de ajuste lo impide).
    cantidad: { type: Number, required: true, min: 0, default: 0 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

esquemaProducto.plugin(aislamientoTenant);

// Un producto no se repite por nombre dentro de la misma sede.
esquemaProducto.index({ tenant: 1, sede: 1, nombre: 1 }, { unique: true });
esquemaProducto.index({ tenant: 1, sede: 1 });

export const esquema = esquemaProducto;
export const nombreModelo = 'Producto';
