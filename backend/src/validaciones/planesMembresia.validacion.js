import { z } from 'zod';
import { idMongo } from './comunes.validacion.js';

/**
 * Un plan se mide en meses O en dias, exactamente uno (`duracionMeses` para
 * mensualidades, `duracionDias` para pases de dia / semanales). El `.refine`
 * lo garantiza en el borde; el modelo lo vuelve a exigir con su hook.
 */
const cuerpoPlan = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    precio: z.number().min(0),
    // Cada plan es de UNA sede. Para un sede_admin es opcional: el servicio la
    // fuerza a la suya (mismo contrato que inventario/maquinas).
    sede: idMongo.optional(),
    duracionMeses: z.number().int().min(1).optional(),
    duracionDias: z.number().int().min(1).optional(),
  })
  .refine((datos) => (datos.duracionMeses == null) !== (datos.duracionDias == null), {
    message: 'Indica la duracion en meses O en dias, exactamente una',
    path: ['duracionMeses'],
  });

export const esquemaCrearPlanMembresia = { body: cuerpoPlan };

export const esquemaListarPlanesMembresia = {
  query: z.object({ sede: idMongo.optional() }),
};

export const esquemaActualizarPlanMembresia = {
  params: z.object({ id: idMongo }),
  // En update se permite tocar solo algunos campos; si viene alguna duracion,
  // el servicio limpia la otra para que nunca queden las dos a la vez.
  body: z
    .object({
      nombre: z.string().trim().min(1).optional(),
      precio: z.number().min(0).optional(),
      duracionMeses: z.number().int().min(1).optional(),
      duracionDias: z.number().int().min(1).optional(),
      activo: z.boolean().optional(),
    })
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' })
    .refine((datos) => !(datos.duracionMeses != null && datos.duracionDias != null), {
      message: 'No puede tener meses y dias a la vez',
      path: ['duracionMeses'],
    }),
};
