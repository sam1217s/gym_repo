import { z } from 'zod';

import { PROVEEDORES_WHATSAPP } from '../config/constantes.js';
import { idMongo } from './comunes.validacion.js';

/**
 * Canal de WhatsApp de un gimnasio. Lo configura el super_admin (`:id` en la
 * URL). Cada proveedor pide credenciales distintas, asi que se valida como
 * union discriminada: elegir `twilio` sin Account SID, o `n8n` sin URL, es un 400.
 */
const twilio = z.object({
  proveedor: z.literal(PROVEEDORES_WHATSAPP.TWILIO),
  accountSid: z.string().trim().min(1, 'El Account SID es obligatorio'),
  /**
   * Auth Token de la cuenta de Twilio. Es el secreto: no vuelve al cliente, asi
   * que el panel no puede reenviarlo al reguardar. Opcional aqui, y el servicio
   * conserva el que ya estaba; si no hay ninguno, es el servicio quien rechaza.
   * Sirve tanto para enviar como para verificar la firma de los entrantes.
   */
  authToken: z.string().trim().min(1).optional(),
  // Numero de WhatsApp de Twilio (E.164; se acepta con o sin `whatsapp:`/'+').
  numero: z.string().trim().min(1, 'El numero de WhatsApp es obligatorio'),
  /**
   * Content SID (`HX...`) de cada plantilla aprobada en Twilio. Opcionales: sin
   * el de una plantilla, ese envio en particular falla (pero el canal recibe y
   * responde igual). Se conservan los previos si llegan vacios.
   */
  plantillaVencimiento: z.string().trim().optional(),
  plantillaBienvenida: z.string().trim().optional(),
  plantillaRecibo: z.string().trim().optional(),
});

const n8n = z.object({
  proveedor: z.literal(PROVEEDORES_WHATSAPP.N8N),
  urlWebhook: z.string().trim().url('La URL del webhook es invalida'),
});

const ninguno = z.object({
  proveedor: z.literal(PROVEEDORES_WHATSAPP.NINGUNO),
});

export const esquemaGuardarWhatsapp = {
  params: z.object({ id: idMongo }),
  body: z.discriminatedUnion('proveedor', [twilio, n8n, ninguno]),
};
