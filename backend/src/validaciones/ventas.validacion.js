import { z } from 'zod';
import { diaCivil, idMongo } from './comunes.validacion.js';

/** Ventas de productos del inventario, por sede. */

export const esquemaRegistrarVenta = {
  body: z.object({
    producto: idMongo,
    cantidad: z.number().int().positive('La cantidad debe ser al menos 1'),
  }),
};

/**
 * Listado de ventas por rango de fecha. `desde`/`hasta` son dias civiles
 * (medianoche local, no UTC: ver `diaCivil`). Sin rango, el servicio asume HOY.
 */
export const esquemaListarVentas = {
  query: z.object({
    sede: idMongo.optional(),
    desde: diaCivil.optional(),
    hasta: diaCivil.optional(),
  }),
};
