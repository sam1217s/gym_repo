import { z } from 'zod';
import { idMongo } from './comunes.validacion.js';

/** Bandeja de WhatsApp: comprobantes que mandan los miembros y respuestas. */

export const esquemaListarMensajes = {
  query: z.object({
    miembro: idMongo.optional(),
    // Filtrar por sede (solo lo usa el dueño; a un sede_admin ya lo acota su rol).
    sede: idMongo.optional(),
    // "true" para ver solo lo que falta por atender.
    pendientes: z.enum(['true', 'false']).optional(),
  }),
};

export const esquemaResponder = {
  body: z.object({
    // Se responde AL HILO de un mensaje: de ahi sale el telefono y la sede.
    mensaje: idMongo,
    texto: z.string().trim().min(1, 'Escribe algo').max(1000),
  }),
};

export const esquemaMarcarLeidos = {
  body: z.object({ ids: z.array(idMongo).optional() }),
};
