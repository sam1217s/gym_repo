import { z } from 'zod';

/**
 * Llaves Wompi DEL GIMNASIO con las que el propio miembro paga su mensualidad.
 * Las tres son obligatorias al guardar: sin cualquiera de ellas el cobro en
 * linea no funciona (no se puede firmar el checkout ni verificar el webhook).
 */
export const esquemaGuardarCobros = {
  body: z.object({
    llavePublica: z.string().trim().min(1, 'La llave publica es obligatoria'),
    secretoIntegridad: z.string().trim().min(1, 'El secreto de integridad es obligatorio'),
    secretoEventos: z.string().trim().min(1, 'El secreto de eventos es obligatorio'),
  }),
};
