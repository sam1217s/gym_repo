import { z } from 'zod';
import { METODOS_PAGO } from '../config/constantes.js';
import { idMongo } from './comunes.validacion.js';

export const esquemaListarPagos = {
  query: z.object({
    miembro: idMongo.optional(),
  }),
};

export const esquemaRegistrarPago = {
  body: z
    .object({
      miembro: idMongo,
      planMembresia: idMongo,
      metodoPago: z.enum(Object.values(METODOS_PAGO)),
      referencia: z.string().trim().optional(),

      // Si no viaja, el servicio usa el precio del plan.
      monto: z.number().min(0).optional(),

      // Permite registrar pagos retroactivos. Por defecto: hoy.
      periodoInicio: z.coerce.date().optional(),
    })
    .refine(
      (datos) => datos.metodoPago !== METODOS_PAGO.TRANSFERENCIA || Boolean(datos.referencia),
      {
        message: 'La referencia es obligatoria en una transferencia',
        path: ['referencia'],
      },
    ),
};
