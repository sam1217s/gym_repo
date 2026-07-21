import mongoose from 'mongoose';
import { ESTADOS_MAQUINA } from '../config/constantes.js';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. Reporte de una maquina que un encargado de sede (`sede_admin`)
 * marca como en `mantenimiento` o `danada`. Es un aviso para el DUEÑO del
 * gimnasio, que ve estos reportes en su panel y decide que hacer.
 *
 * Es un registro de EVENTO (foto del momento): guarda el nombre de la maquina,
 * el estado reportado, la nota y quien lo reporto, para que el reporte se
 * sostenga aunque la maquina cambie o se archive despues.
 *
 * `leido` es del punto de vista del dueño: al abrir el panel de reportes se
 * marcan leidos, y entonces dejan de dispararle la notificacion de inicio de
 * sesion, AUNQUE la maquina siga sin arreglarse. El reporte no se borra: sigue
 * en el panel para consultarlo cuando quiera.
 */
const esquemaReporteMaquina = new mongoose.Schema(
  {
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', required: true },
    maquina: { type: mongoose.Schema.Types.ObjectId, ref: 'Maquina', required: true },
    // Foto del nombre y el estado al reportar (la maquina puede cambiar despues).
    nombreMaquina: { type: String, required: true, trim: true },
    estado: {
      type: String,
      enum: [ESTADOS_MAQUINA.MANTENIMIENTO, ESTADOS_MAQUINA.DANADA],
      required: true,
    },
    nota: { type: String, trim: true },
    reportadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    reportadoPorNombre: { type: String, required: true, trim: true },
    // `false` hasta que el dueño abre su panel de reportes.
    leido: { type: Boolean, default: false },
  },
  { timestamps: true },
);

esquemaReporteMaquina.plugin(aislamientoTenant);

// El panel del dueño ordena por fecha; la notificacion cuenta los no leidos.
esquemaReporteMaquina.index({ tenant: 1, leido: 1, createdAt: -1 });
esquemaReporteMaquina.index({ tenant: 1, createdAt: -1 });

export const esquema = esquemaReporteMaquina;
export const nombreModelo = 'ReporteMaquina';
