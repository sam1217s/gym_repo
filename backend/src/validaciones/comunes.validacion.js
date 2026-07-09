import { z } from 'zod';

/** Piezas Zod compartidas por varios recursos. */

export const idMongo = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador invalido');

export const esquemaIdParam = {
  params: z.object({ id: idMongo }),
};

/** Formato internacional sin '+' ni espacios, listo para WhatsApp: "573001234567". */
export const telefonoWhatsApp = z
  .string()
  .trim()
  .regex(/^\d{10,15}$/, 'Telefono en formato internacional, ej: 573001234567');
