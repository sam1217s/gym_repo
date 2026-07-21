import mongoose from 'mongoose';
import { ESTADOS_MAQUINA, LISTA_ESTADOS_MAQUINA } from '../config/constantes.js';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Maquinas e implementos del gimnasio, POR SEDE (mancuernas,
 * caminadoras, poleas...). El dueño lleva su estado para saber que necesita
 * revision: `operativa`, en `mantenimiento` o `danada`.
 *
 * El aislamiento por tenant lo pone el plugin; el alcance por sede lo aplican
 * los servicios con `filtroSede` (igual que Producto/Miembro/Pago), asi que un
 * sede_admin solo ve y toca las maquinas de SU sede.
 */
const esquemaMaquina = new mongoose.Schema(
  {
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', required: true },
    nombre: { type: String, required: true, trim: true },
    estado: {
      type: String,
      enum: LISTA_ESTADOS_MAQUINA,
      default: ESTADOS_MAQUINA.OPERATIVA,
    },
    // Detalle libre de la falla o el mantenimiento pendiente. Opcional.
    nota: { type: String, trim: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

esquemaMaquina.plugin(aislamientoTenant);

// Una maquina no se repite por nombre dentro de la misma sede.
esquemaMaquina.index({ tenant: 1, sede: 1, nombre: 1 }, { unique: true });
esquemaMaquina.index({ tenant: 1, sede: 1 });

export const esquema = esquemaMaquina;
export const nombreModelo = 'Maquina';
