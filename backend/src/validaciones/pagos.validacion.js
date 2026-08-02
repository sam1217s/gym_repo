import { z } from 'zod';
import { METODOS_PAGO } from '../config/constantes.js';
import { diaCivil, idMongo } from './comunes.validacion.js';

export const esquemaListarPagos = {
  query: z.object({
    miembro: idMongo.optional(),
  }),
};

/**
 * Correccion de un pago YA registrado (solo el dueño). Todo es opcional: se
 * corrige lo que se equivoco. Si cambia `periodoInicio` (o el plan), el servicio
 * RECALCULA el `periodoFin`, que es de donde sale el vencimiento del miembro.
 */
export const esquemaEditarPago = {
  params: z.object({ id: idMongo }),
  body: z
    .object({
      planMembresia: idMongo,
      metodoPago: z.enum(Object.values(METODOS_PAGO)),
      referencia: z.string().trim(),
      monto: z.number().min(0),
      periodoInicio: diaCivil,
    })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' }),
};

export const esquemaRegistrarPago = {
  // La referencia es SIEMPRE opcional, tambien en transferencia: en un cobro
  // presencial el encargado ve el comprobante y valida a mano, y teclear la
  // referencia lo hace lento. En la bandeja, la foto del comprobante es el
  // rastro. Se guarda si la ponen, no se exige.
  body: z.object({
    miembro: idMongo,
    planMembresia: idMongo,
    metodoPago: z.enum(Object.values(METODOS_PAGO)),
    referencia: z.string().trim().optional(),

    // Si no viaja, el servicio usa el precio del plan.
    monto: z.number().min(0).optional(),

    // Permite registrar pagos retroactivos. Por defecto: hoy.
    // `diaCivil` y no `z.coerce.date()`: "2026-07-09" es un dia, no un instante UTC.
    periodoInicio: diaCivil.optional(),

    // La bandeja lo manda en true: alli ya se responde texto libre gratis, asi
    // que no se envia tambien el recibo de plantilla (evita duplicar y cobrar).
    omitirRecibo: z.boolean().optional(),
  }),
};
