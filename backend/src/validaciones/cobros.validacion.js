import { z } from 'zod';

import { idMongo } from './comunes.validacion.js';

/**
 * Llaves Wompi DEL GIMNASIO con las que el propio miembro paga su mensualidad.
 * Las configura el super_admin por gimnasio (`:id` en la URL). Las tres son
 * obligatorias: sin cualquiera de ellas no se puede firmar el checkout ni
 * verificar el webhook.
 */
export const esquemaGuardarCobros = {
  params: z.object({ id: idMongo }),
  body: z.object({
    llavePublica: z.string().trim().min(1, 'La llave publica es obligatoria'),
    secretoIntegridad: z.string().trim().min(1, 'El secreto de integridad es obligatorio'),
    secretoEventos: z.string().trim().min(1, 'El secreto de eventos es obligatorio'),
  }),
};
