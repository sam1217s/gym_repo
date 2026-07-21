import { z } from 'zod';
import { LISTA_ESTADOS_MAQUINA } from '../config/constantes.js';
import { idMongo } from './comunes.validacion.js';

/** Maquinas e implementos por sede, con estado de mantenimiento. */

const estadoMaquina = z.enum(LISTA_ESTADOS_MAQUINA);

export const esquemaListarMaquinas = {
  query: z.object({
    sede: idMongo.optional(),
    estado: estadoMaquina.optional(),
    activo: z.enum(['true', 'false']).optional(),
  }),
};

export const esquemaCrearMaquina = {
  body: z.object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    // Para un sede_admin es opcional: el servicio la fuerza a la suya.
    sede: idMongo.optional(),
    estado: estadoMaquina.optional(),
    nota: z.string().trim().max(500).optional(),
  }),
};

export const esquemaActualizarMaquina = {
  params: z.object({ id: idMongo }),
  body: z
    .object({
      nombre: z.string().trim().min(1),
      estado: estadoMaquina,
      // Cadena vacia limpia la nota; por eso no exige min(1).
      nota: z.string().trim().max(500),
      activo: z.boolean(),
    })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' }),
};
