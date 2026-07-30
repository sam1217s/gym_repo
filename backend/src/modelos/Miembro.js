import mongoose from 'mongoose';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Un cliente del gimnasio.
 *
 * OJO: el miembro NO tiene campo de vencimiento. El vencimiento se DERIVA del
 * `periodoFin` de su ultimo `Pago`. Ver `servicios/vencimientos.servicio.js`.
 * Guardarlo aqui crearia dos fuentes de verdad que tarde o temprano divergen.
 */
const esquemaMiembro = new mongoose.Schema(
  {
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', required: true },
    nombres: { type: String, required: true, trim: true },
    apellidos: { type: String, required: true, trim: true },
    documento: { type: String, required: true, trim: true },

    // Formato internacional sin '+' ni espacios, listo para WhatsApp: "573001234567".
    telefono: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10,15}$/, 'El telefono debe ir en formato internacional, ej: 573001234567'],
    },

    /**
     * OPCIONAL. Solo se usa para prellenar el checkout de Wompi cuando el miembro
     * paga en linea y para el recibo. Los miembros no inician sesion, asi que no
     * es unico ni obligatorio.
     */
    email: { type: String, lowercase: true, trim: true },

    fechaRegistro: { type: Date, default: Date.now },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

esquemaMiembro.plugin(aislamientoTenant);

// El documento identifica al miembro dentro del gimnasio, no dentro de la sede:
// puede entrenar en varias sedes con la misma cedula.
esquemaMiembro.index({ tenant: 1, documento: 1 }, { unique: true });
esquemaMiembro.index({ tenant: 1, sede: 1 });
// Cubre el listado del panel: filtra por activo y ordena por mas reciente,
// sin ordenar en memoria.
esquemaMiembro.index({ tenant: 1, activo: 1, createdAt: -1 });

esquemaMiembro.virtual('nombreCompleto').get(function () {
  return `${this.nombres} ${this.apellidos}`.trim();
});

esquemaMiembro.set('toJSON', { virtuals: true });

export const esquema = esquemaMiembro;
export const nombreModelo = 'Miembro';
