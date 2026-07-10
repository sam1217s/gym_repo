import { z } from 'zod';
import { idMongo } from './comunes.validacion.js';

const cuerpoPlan = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  precio: z.number().min(0),
  duracionMeses: z.number().int().min(1),
});

export const esquemaCrearPlanMembresia = { body: cuerpoPlan };

export const esquemaActualizarPlanMembresia = {
  params: z.object({ id: idMongo }),
  body: cuerpoPlan
    .extend({ activo: z.boolean() })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' }),
};
