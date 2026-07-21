import { z } from 'zod';
import { idMongo } from './comunes.validacion.js';

/** Inventario por sede: productos con existencias. */

export const esquemaListarInventario = {
  query: z.object({ sede: idMongo.optional(), activo: z.enum(['true', 'false']).optional() }),
};

export const esquemaCrearProducto = {
  body: z.object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    // Para un sede_admin es opcional: el servicio la fuerza a la suya.
    sede: idMongo.optional(),
    cantidad: z.number().int().min(0).optional(),
  }),
};

export const esquemaActualizarProducto = {
  params: z.object({ id: idMongo }),
  body: z
    .object({
      nombre: z.string().trim().min(1),
      activo: z.boolean(),
    })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' }),
};

/**
 * Ajuste de existencias: `delta` positivo entra stock, negativo lo saca. Nunca
 * cero (no seria un ajuste). El servicio impide que las existencias bajen de 0.
 */
export const esquemaAjustarStock = {
  params: z.object({ id: idMongo }),
  body: z.object({
    delta: z.number().int().refine((valor) => valor !== 0, { message: 'El ajuste no puede ser cero' }),
  }),
};
