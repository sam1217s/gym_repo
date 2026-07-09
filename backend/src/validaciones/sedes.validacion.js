import { z } from 'zod';
import { idMongo } from './comunes.validacion.js';

const cuerpoSede = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  direccion: z.string().trim().min(1, 'La direccion es obligatoria'),
  telefono: z.string().trim().optional(),
});

export const esquemaCrearSede = { body: cuerpoSede };

export const esquemaActualizarSede = {
  params: z.object({ id: idMongo }),
  body: cuerpoSede
    .extend({ activa: z.boolean() })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' }),
};
