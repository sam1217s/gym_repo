import mongoose from 'mongoose';
import { aislamientoTenant } from './complementos/aislamientoTenant.js';

/**
 * TENANT-SCOPED. La conversacion de WhatsApp con un miembro: lo que el escribe
 * (comprobantes de pago, dudas) y lo que el gimnasio le responde desde el panel.
 *
 * Existe porque un numero conectado a la Cloud API NO tiene bandeja de entrada:
 * sin esto, el mensaje del miembro llega a Meta y no lo ve nadie.
 *
 * `sede` se hereda del miembro para que el contrato `filtroSede` funcione igual
 * que en el resto: un sede_admin solo ve la conversacion de SUS miembros. Si el
 * numero no corresponde a ningun miembro, queda en `null` y solo lo ve el dueño.
 *
 * `idMensajeWhatsapp` (el `wamid` de Meta) es la clave de IDEMPOTENCIA: Meta
 * reintenta los webhooks, y sin ese indice el mismo comprobante entraria dos
 * veces. Misma regla que `Pago.transaccionWompi`.
 */
const esquemaMensajeWhatsapp = new mongoose.Schema(
  {
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', default: null },
    miembro: { type: mongoose.Schema.Types.ObjectId, ref: 'Miembro', default: null },
    /** Siempre en formato internacional, como lo manda Meta: "573001234567". */
    telefono: { type: String, required: true, trim: true },

    direccion: { type: String, enum: ['entrante', 'saliente'], required: true },
    tipo: {
      type: String,
      enum: ['texto', 'imagen', 'documento', 'audio', 'video', 'otro'],
      default: 'texto',
    },

    /** Cuerpo del mensaje o pie de foto. Puede ir vacio si solo mandaron imagen. */
    texto: { type: String, trim: true, default: '' },

    /** Identificador del archivo en Meta. Se guarda por trazabilidad. */
    mediaId: { type: String, default: null },
    /** Ruta relativa dentro del almacen, una vez descargado el comprobante. */
    archivo: { type: String, default: null },
    mimeType: { type: String, default: null },

    /** `wamid` de Meta. Unico por tenant: impide duplicar por reintentos. */
    idMensajeWhatsapp: { type: String, default: null },

    /** Del lado del gimnasio: los entrantes nacen sin leer. */
    leido: { type: Boolean, default: false },
    /** Quien respondio, en los salientes. */
    enviadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  },
  { timestamps: true },
);

esquemaMensajeWhatsapp.plugin(aislamientoTenant);

// La bandeja ordena por fecha; el hilo de un miembro se lee por separado.
esquemaMensajeWhatsapp.index({ tenant: 1, createdAt: -1 });
esquemaMensajeWhatsapp.index({ tenant: 1, miembro: 1, createdAt: -1 });
// Pendientes por atender.
esquemaMensajeWhatsapp.index({ tenant: 1, direccion: 1, leido: 1 });

// Idempotencia de los webhooks: parcial porque los salientes no traen wamid.
esquemaMensajeWhatsapp.index(
  { tenant: 1, idMensajeWhatsapp: 1 },
  { unique: true, partialFilterExpression: { idMensajeWhatsapp: { $type: 'string' } } },
);

export const esquema = esquemaMensajeWhatsapp;
export const nombreModelo = 'MensajeWhatsapp';
