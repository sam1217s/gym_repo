import { z } from 'zod';

import { PROVEEDORES_WHATSAPP } from '../config/constantes.js';
import { idMongo } from './comunes.validacion.js';

/**
 * Canal de WhatsApp de un gimnasio. Lo configura el super_admin (`:id` en la
 * URL). Cada proveedor pide credenciales distintas, asi que se valida como
 * union discriminada: elegir `cloud_api` sin token, o `n8n` sin URL, es un 400.
 *
 * `baileys` NO se acepta: no esta implementado y dejaria el canal roto en
 * silencio hasta la corrida del cron.
 */
const cloudApi = z.object({
  proveedor: z.literal(PROVEEDORES_WHATSAPP.CLOUD_API),
  // "Phone number ID" del numero en Meta (no es el telefono, es un id numerico).
  idTelefono: z.string().trim().min(1, 'El ID del telefono es obligatorio'),
  /**
   * Token permanente de la app de Meta. Es el secreto: no vuelve al cliente, asi
   * que el panel no puede reenviarlo al reguardar. Opcional aqui, y el servicio
   * conserva el que ya estaba; si no hay ninguno, es el servicio quien rechaza.
   * Exigirlo aqui obligaria a repegar un token que Meta solo muestra una vez.
   */
  token: z.string().trim().min(1).optional(),
  /**
   * Clave secreta de la app. OPCIONAL para enviar, OBLIGATORIA para RECIBIR:
   * con ella se verifica la firma de los mensajes entrantes. Sin verificar la
   * firma, cualquiera podria inyectar comprobantes falsos en la bandeja.
   */
  secretoApp: z.string().trim().min(1).optional(),
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
  body: z.discriminatedUnion('proveedor', [cloudApi, n8n, ninguno]),
};
