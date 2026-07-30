import { z } from 'zod';
import { METODOS_PAGO } from '../config/constantes.js';
import { diaCivil, idMongo } from './comunes.validacion.js';

export const esquemaListarPagos = {
  query: z.object({
    miembro: idMongo.optional(),
  }),
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
  }),
};
