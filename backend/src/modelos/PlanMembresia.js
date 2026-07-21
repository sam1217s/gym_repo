import mongoose from 'mongoose';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED y POR SEDE. Lo que un miembro le paga al gimnasio.
 * Cada SEDE define los suyos: "Mensual" 60000 / 1 mes, "Trimestral" 160000 / 3 meses,
 * "Pase de dia" 8000 / 1 dia. Dos sedes pueden tener el mismo plan a distinto precio,
 * y un plan solo se puede cobrar a miembros de SU sede (lo exige `pagos.servicio`).
 *
 * La duracion se mide en MESES **o** en DIAS, nunca las dos: un plan lleva
 * `duracionMeses` (mensualidades) o `duracionDias` (pases de dia / semanales),
 * y exactamente uno de los dos (lo garantiza el hook de abajo). Los meses son de
 * CALENDARIO: quien paga el 31 de enero vence el 28 de febrero, no 30 dias despues.
 *
 * No confundir con `PlanPlataforma`, que es lo que el gimnasio le paga a GymSaaS.
 */
const esquemaPlanMembresia = new mongoose.Schema(
  {
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', required: true },
    nombre: { type: String, required: true, trim: true },
    precio: { type: Number, required: true, min: 0 },
    duracionMeses: { type: Number, min: 1 },
    duracionDias: { type: Number, min: 1 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

esquemaPlanMembresia.plugin(aislamientoTenant);

// El nombre no se repite DENTRO de una sede; otra sede si puede reutilizarlo.
esquemaPlanMembresia.index({ tenant: 1, sede: 1, nombre: 1 }, { unique: true });
esquemaPlanMembresia.index({ tenant: 1, sede: 1, activo: 1 });

/** Exactamente una unidad de duracion: o meses, o dias, nunca ambas ni ninguna. */
esquemaPlanMembresia.pre('validate', function (siguiente) {
  const tieneMeses = this.duracionMeses != null;
  const tieneDias = this.duracionDias != null;
  if (tieneMeses === tieneDias) {
    this.invalidate('duracionMeses', 'Indica la duracion en meses O en dias, exactamente una.');
  }
  siguiente();
});

/** Texto legible de la duracion: "1 mes", "3 meses", "1 dia", "7 dias". */
esquemaPlanMembresia.virtual('descripcionDuracion').get(function () {
  if (this.duracionDias != null) {
    return this.duracionDias === 1 ? '1 dia' : `${this.duracionDias} dias`;
  }
  return this.duracionMeses === 1 ? '1 mes' : `${this.duracionMeses} meses`;
});

esquemaPlanMembresia.set('toJSON', { virtuals: true });

export const esquema = esquemaPlanMembresia;
export const nombreModelo = 'PlanMembresia';
